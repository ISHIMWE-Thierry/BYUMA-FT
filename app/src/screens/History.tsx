import type { App } from '../useApp'
import { today } from '../useApp'
import type { Expense } from '../types'
import { amountIn, byDay, periods, phaseDays, shortDate, sumIn, type Period } from '../lib/calc'
import { groupTyped, sanitizeAmount } from '../lib/money'
import {
  BinIcon,
  ChevronRight,
  CrossIcon,
  MICON,
  PlusIcon,
} from '../components/icons'
import { ACCENT, ChipScroller, DANGER, FormError, LINE, pick } from '../components/ui'

/**
 * Everything recorded, newest first, cut into periods: a phase takes the
 * expenses recorded while it ran, and the months take the rest. The strip
 * along the top picks one period to read; a phase being read shows what it
 * spans and holds, and can be ended from there. "Start a phase" opens a
 * one-line form, and from then on new expenses fall into it.
 *
 * Tapping a row opens the editor beneath it - amount, note, details, how it
 * was paid and the day it happened. The cross deletes, and always asks first.
 */
export function History({ app }: { app: App }) {
  const { data, mainCur } = app
  const items = data.items
  const rates = data.rates
  const all = periods(items, data.phases)
  const current = all.find((p) => p.key === app.histPeriod) ?? null
  const running = data.phases.find((p) => !p.to) ?? null
  const listed = current ? current.items : items
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

  return (
    <div className="page">
      <ChipScroller className="phase-strip">
        <button
          type="button"
          className="phase-chip"
          style={pick(!current, '#fff', '#4b4f5e')}
          onClick={() => app.setHistPeriod(null)}
        >
          All
        </button>
        {all.map((p) => (
          <button
            key={p.key}
            type="button"
            className="phase-chip"
            style={pick(current?.key === p.key, '#fff', '#4b4f5e')}
            onClick={() => app.setHistPeriod(current?.key === p.key ? null : p.key)}
          >
            {p.phase && !p.phase.to && <span className="phase-live" />}
            {p.label}
          </button>
        ))}
        {!running && app.newPhase === null && (
          <button
            type="button"
            className="phase-chip phase-chip-add"
            onClick={() => app.setNewPhase('')}
          >
            ＋ Start a phase
          </button>
        )}
      </ChipScroller>

      {/* Naming the phase that starts today. */}
      {app.newPhase !== null && (
        <>
          <div className="sel-bar">
            <input
              className="sel-name"
              type="text"
              placeholder="Name it — Rwanda, Back home…"
              autoFocus
              value={app.newPhase}
              onChange={(e) => {
                app.setNewPhase(e.target.value)
                app.clearErr()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') app.startPhase()
              }}
              style={{ borderColor: app.errField === 'newphase' ? DANGER : LINE }}
            />
            <button type="button" className="sel-cancel" onClick={() => app.setNewPhase(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="sel-save"
              style={{ background: ACCENT }}
              onClick={app.startPhase}
            >
              Start
            </button>
          </div>
          <FormError message={app.errField === 'newphase' ? app.formError : ''} />
        </>
      )}

      {current?.phase ? (
        <PhaseCard app={app} period={current} />
      ) : (
        <div className="hist-head">
          <span className="label-sm">{current ? current.label : 'All expenses'}</span>
          <span className="hist-count">
            {listed.length === 1 ? '1 expense' : listed.length + ' expenses'}
          </span>
        </div>
      )}

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
                <Row key={item.id} app={app} item={item} first={ix === 0} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The phase being read: what it spans, what it holds, and its doors. */
function PhaseCard({ app, period }: { app: App; period: Period }) {
  const { data, mainCur } = app
  const ph = period.phase!
  const spent = sumIn(data.rates, period.items, mainCur)
  const days = phaseDays(ph)
  return (
    <div className="phase-card">
      <div className="phase-card-top">
        <span className="phase-card-name">
          {ph.name}
          {ph.offBooks && <span className="phase-tag">out of totals</span>}
        </span>
        <span className="phase-card-dates">
          {shortDate(ph.from)} — {ph.to ? shortDate(ph.to) : 'now'} · {days}{' '}
          {days === 1 ? 'day' : 'days'}
        </span>
      </div>
      <div className="phase-card-figures">
        <span className="phase-card-sum">{app.fmt(spent)}</span>
        <span className="phase-card-count">
          {period.items.length === 1 ? '1 expense' : period.items.length + ' expenses'}
        </span>
      </div>
      <div className="phase-card-actions">
        {!ph.to && (
          <button type="button" className="phase-card-btn" onClick={() => app.endPhase(ph)}>
            End today
          </button>
        )}
        <button
          type="button"
          className="phase-card-btn"
          onClick={() => app.openPhase(ph.id, 'history')}
        >
          Details
          <ChevronRight size={12} color="#9497a5" />
        </button>
      </div>
    </div>
  )
}

function Row({ app, item, first }: { app: App; item: Expense; first: boolean }) {
  const Icon = MICON[item.method]
  const editing = app.editId === item.id
  const shown = amountIn(app.data.rates, item, app.mainCur)

  return (
    <div style={{ borderTop: first ? '1px solid transparent' : '1px solid rgba(20,22,31,.055)' }}>
      <div className="tl-row" onClick={() => app.openEditor(item)}>
        <span
          className="tl-tile"
          style={{
            background: item.method === 'cash' ? 'rgba(20,22,31,.05)' : 'rgba(20,22,31,.08)',
          }}
        >
          <Icon />
        </span>
        <span className="tl-note">{item.note || app.methodName(item.method)}</span>
        <span className="tl-amount">{app.fmt(shown)}</span>
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
          {/* How it was paid. A way kept off the recorder is still offered
              here for the expense that was already paid that way. */}
          <div className="editor-methods">
            {(['cash', 'bank', 'momo'] as const)
              .filter((m) => app.methods.includes(m) || m === item.method)
              .map((m) => (
                <button
                  key={m}
                  type="button"
                  className="editor-method"
                  style={pick(app.eMethod === m)}
                  onClick={() => app.setEMethod(m)}
                >
                  {app.methodName(m)}
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
