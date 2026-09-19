import { useRef } from 'react'
import type { App } from '../useApp'
import { today } from '../useApp'
import type { Expense, Phase } from '../types'
import { amountIn, byDay, phaseHas, phaseItems, shortDate, sortPhases, sumIn } from '../lib/calc'
import { groupTyped, sanitizeAmount } from '../lib/money'
import {
  BinIcon,
  ChevronRight,
  CrossIcon,
  MICON,
  PlusIcon,
} from '../components/icons'
import { ACCENT, ChipScroller, DANGER, FormError, LINE, pick } from '../components/ui'

/** How long a finger rests on a row before it counts as holding it. */
const HOLD_MS = 450

/**
 * Everything recorded, newest first, grouped by day. Lifted off the recorder
 * so that screen is only about capturing an expense in a few seconds; reading
 * back over the week is a different job and now has its own tab.
 *
 * Tapping a row opens the editor beneath it - amount, note, details, method
 * and the day it happened. The cross deletes, and always asks first.
 *
 * With Pro, phases live along the top: a strip of names that filters the
 * list, a card that sums the one being read, and two ways to make one —
 * hold the first expense of a run and tap its last, or pick expenses into
 * a phase that already exists.
 */
export function History({ app }: { app: App }) {
  const { data, mainCur } = app
  const items = data.items
  const rates = data.rates
  const phases = app.pro ? sortPhases(data.phases) : []
  const current = phases.find((p) => p.id === app.histPhase) ?? null
  const picking = app.pickFor ? data.phases.find((p) => p.id === app.pickFor) ?? null : null

  // Picking shows everything, so what is outside the phase can be reached;
  // reading a phase shows only what is in it.
  const listed = current && !picking ? phaseItems(items, current) : items
  const groups = byDay(listed)

  if (items.length === 0) {
    return (
      <div className="page">
        <div className="empty">
          <span className="empty-badge">{data.cleared ? <BinIcon /> : <PlusIcon />}</span>
          <div className="empty-title">
            {data.cleared ? 'Everything deleted' : 'No expenses yet'}
          </div>
          <div className="empty-sub">
            {data.cleared ? 'Nothing left to show.' : 'Your first one lands here.'}
          </div>
          <button
            type="button"
            className="btn-analytics empty-action"
            style={{ background: ACCENT, borderColor: ACCENT, color: '#fff' }}
            onClick={() => app.go('home')}
          >
            Record one
          </button>
        </div>
      </div>
    )
  }

  const selecting = !!app.selStart
  const named = app.selIds.length > 0

  return (
    <div className="page">
      {app.pro && (
        <ChipScroller className="phase-strip">
          <button
            type="button"
            className="phase-chip"
            style={pick(!current, '#fff', '#4b4f5e')}
            onClick={() => app.setHistPhase(null)}
          >
            All
          </button>
          {phases.map((p) => (
            <button
              key={p.id}
              type="button"
              className="phase-chip"
              style={pick(current?.id === p.id, '#fff', '#4b4f5e')}
              onClick={() => app.setHistPhase(current?.id === p.id ? null : p.id)}
            >
              {p.name}
            </button>
          ))}
          {phases.length === 0 && !selecting && (
            <span className="phase-hint">Hold an expense, tap the last one</span>
          )}
        </ChipScroller>
      )}

      {/* The run being drawn: first a word of what to do, then the name. */}
      {selecting && (
        <div className="sel-bar">
          {!named ? (
            <>
              <span className="sel-text">Now tap the last one</span>
              <button type="button" className="sel-cancel" onClick={app.cancelSelect}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <input
                className="sel-name"
                type="text"
                placeholder="Name the phase"
                autoFocus
                value={app.selName}
                onChange={(e) => {
                  app.setSelName(e.target.value)
                  app.clearErr()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') app.savePhaseFromSelection()
                }}
                style={{ borderColor: app.errField === 'selname' ? DANGER : LINE }}
              />
              <button type="button" className="sel-cancel" onClick={app.cancelSelect}>
                Cancel
              </button>
              <button
                type="button"
                className="sel-save"
                style={{ background: ACCENT }}
                onClick={app.savePhaseFromSelection}
              >
                Save
              </button>
            </>
          )}
        </div>
      )}
      {selecting && named && (
        <FormError message={app.errField === 'selname' ? app.formError : ''} />
      )}

      {/* Picking expenses into a phase from outside its dates. */}
      {picking && (
        <div className="sel-bar">
          <span className="sel-text">
            {app.picked.length
              ? app.picked.length + ' to add to ' + picking.name
              : 'Tap what belongs in ' + picking.name}
          </span>
          <button type="button" className="sel-cancel" onClick={app.cancelSelect}>
            Cancel
          </button>
          <button
            type="button"
            className="sel-save"
            style={{ background: ACCENT }}
            onClick={app.savePick}
          >
            Add
          </button>
        </div>
      )}

      {current && !picking && !selecting && (
        <PhaseCard app={app} phase={current} count={listed.length} />
      )}

      {!current && !selecting && !picking && (
        <div className="hist-head">
          <span className="label-sm">All expenses</span>
          <span className="hist-count">
            {items.length === 1 ? '1 expense' : items.length + ' expenses'}
          </span>
        </div>
      )}

      {listed.length === 0 ? (
        <div className="helper mt-14">Nothing in this phase yet.</div>
      ) : (
        <div className="timeline timeline-top">
          {groups.map((g) => (
            <div className="tl-group" key={g.off}>
              <span className="tl-rule" />
              <span
                className="tl-dot"
                style={{ background: g.off === 0 ? ACCENT : 'rgba(20,22,31,.22)' }}
              />
              <div className="tl-head">
                <span className="tl-day">{g.label}</span>
                <span className="tl-sum">{app.fmt(sumIn(rates, g.items, mainCur))}</span>
              </div>
              <div className="tl-card">
                {g.items.map((item, ix) => (
                  <Row
                    key={item.id}
                    app={app}
                    item={item}
                    first={ix === 0}
                    phase={current}
                    picking={picking}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** The phase being read: what it spans, what it holds, and its two doors. */
function PhaseCard({ app, phase, count }: { app: App; phase: Phase; count: number }) {
  const { data, mainCur } = app
  const spent = sumIn(data.rates, phaseItems(data.items, phase), mainCur)
  return (
    <div className="phase-card">
      <div className="phase-card-top">
        <span className="phase-card-name">{phase.name}</span>
        <span className="phase-card-dates">
          {shortDate(phase.from)} — {phase.to ? shortDate(phase.to) : 'now'}
        </span>
      </div>
      <div className="phase-card-figures">
        <span className="phase-card-sum">{app.fmt(spent)}</span>
        <span className="phase-card-count">
          {count === 1 ? '1 expense' : count + ' expenses'}
        </span>
      </div>
      <div className="phase-card-actions">
        <button type="button" className="phase-card-btn" onClick={() => app.recordInto(phase)}>
          ＋ Record
        </button>
        <button type="button" className="phase-card-btn" onClick={() => app.startPick(phase)}>
          Add missed
        </button>
        <button type="button" className="phase-card-btn" onClick={() => app.openPhase(phase.id, 'history')}>
          Details
          <ChevronRight size={12} color="#9497a5" />
        </button>
      </div>
    </div>
  )
}

function Row({
  app,
  item,
  first,
  phase,
  picking,
}: {
  app: App
  item: Expense
  first: boolean
  phase: Phase | null
  picking: Phase | null
}) {
  const Icon = MICON[app.accKind(item.acc)]
  const editing = app.editId === item.id
  const shown = amountIn(app.data.rates, item, app.mainCur)

  // Holding a row is the start of a phase. A timer decides what "holding"
  // is; lifting or moving the finger before it fires makes it a tap.
  const hold = useRef<number | undefined>(undefined)
  const held = useRef(false)
  const down = () => {
    if (!app.pro || app.pickFor) return
    held.current = false
    window.clearTimeout(hold.current)
    hold.current = window.setTimeout(() => {
      held.current = true
      app.startSelect(item.id)
    }, HOLD_MS)
  }
  const up = () => window.clearTimeout(hold.current)
  const tap = () => {
    if (held.current) {
      held.current = false
      return
    }
    app.tapRow(item)
  }

  const isStart = app.selStart === item.id
  const inRun = app.selIds.includes(item.id)
  const alreadyIn = picking ? phaseHas(picking, item) : false
  const isPicked = app.picked.includes(item.id)
  const byHand = !!phase?.items?.includes(item.id)

  let cls = 'tl-row'
  if (isStart || inRun || isPicked) cls += ' tl-row-picked'
  if (picking && alreadyIn) cls += ' tl-row-dim'

  return (
    <div style={{ borderTop: first ? '1px solid transparent' : '1px solid rgba(20,22,31,.055)' }}>
      <div
        className={cls}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        onContextMenu={(e) => e.preventDefault()}
        onClick={picking && alreadyIn ? undefined : tap}
      >
        <span
          className="tl-tile"
          style={{
            background:
              isStart || inRun || isPicked
                ? ACCENT
                : app.accKind(item.acc) === 'cash'
                  ? 'rgba(20,22,31,.05)'
                  : 'rgba(20,22,31,.08)',
            color: isStart || inRun || isPicked ? '#fff' : undefined,
          }}
        >
          <Icon />
        </span>
        <span className="tl-note">{item.note || app.accName(item.acc)}</span>
        <span className="tl-amount">{app.fmt(shown)}</span>
        {byHand && !picking && !app.selStart ? (
          <button
            type="button"
            className="x-btn"
            aria-label={'Take out of ' + phase!.name}
            onClick={(e) => {
              e.stopPropagation()
              app.unpickFrom(phase!, item.id)
            }}
          >
            <CrossIcon />
          </button>
        ) : (
          !picking &&
          !app.selStart && (
            <button
              type="button"
              className="x-btn"
              aria-label="Delete"
              onClick={(e) => {
                e.stopPropagation()
                app.askDelete(item)
              }}
            >
              <CrossIcon />
            </button>
          )
        )}
      </div>

      {editing && (
        <div className="editor">
          <div className="editor-amt">
            <span className="editor-amt-label">Amount</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label="Amount"
              value={app.eAmt ? groupTyped(app.eAmt) : ''}
              onChange={(e) => app.setEAmt(sanitizeAmount(e.target.value))}
            />
          </div>
          <input
            className="editor-note"
            type="text"
            placeholder="What was it for?"
            value={app.eNote}
            onChange={(e) => app.setENote(e.target.value)}
          />
          <input
            className="editor-note"
            type="text"
            placeholder="Details, if it needs any"
            value={app.eDetail}
            onChange={(e) => app.setEDetail(e.target.value)}
          />
          <div className="editor-date">
            <span className="editor-date-label">Date</span>
            <input
              type="date"
              aria-label="Date"
              max={today()}
              value={app.eDate}
              onChange={(e) => app.setEDate(e.target.value)}
            />
          </div>
          {/* Moving an expense to another account moves the money with
              it: the whole amount goes back where it was and comes out of
              the new one. A hidden account stays offered here for the
              expense that is already on it. */}
          <div className="editor-methods">
            {app.accounts
              .filter((a) => !a.hidden || a.id === item.acc)
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="editor-method"
                  style={pick(app.eAcc === a.id)}
                  onClick={() => app.setEAcc(a.id)}
                >
                  {a.name}
                </button>
              ))}
          </div>
          <div className="editor-actions">
            <button
              type="button"
              className="editor-cancel"
              onClick={() => app.openEditor(item)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="editor-save"
              style={{ background: ACCENT, borderColor: LINE }}
              onClick={() => app.saveEdit(item)}
            >
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
