import type { App } from '../useApp'
import { today } from '../useApp'
import type { Phase } from '../types'
import {
  phaseDays,
  phaseItems,
  shortDate,
  sortPhases,
  sumFrom,
  sumIn,
  topCategories,
} from '../lib/calc'
import { groupTyped, sanitizeAmount } from '../lib/money'
import { ACCENT, ChipScroller, DANGER, FormError, LINE, pick } from '../components/ui'
import { ChevronRight } from '../components/icons'
import { mixColour } from './Home'

const border = (app: App, field: string) => (app.errField === field ? DANGER : LINE)

/* ==================================================================
   Recording into a phase
================================================================== */

/**
 * An expense added straight into a phase, from its card in History or its
 * own page. Amount, how it was paid, what for — and which day. The day is
 * the guide: it opens at today while the phase runs (its last day once it
 * is over) and can only be moved within the phase's dates, so the expense
 * lands where it belongs and nowhere else.
 */
export function PhaseRecordBox({ app, phase }: { app: App; phase: Phase }) {
  const pr = app.phaseRec
  if (!pr || pr.phaseId !== phase.id) return null
  const t = today()
  const last = phase.to && phase.to < t ? phase.to : t

  return (
    <div className="mini-form phase-rec">
      <div className="money-row" style={{ marginBottom: 0, borderColor: border(app, 'pramt') }}>
        <span className="money-code">{app.mainCur}</span>
        <input
          className="money-input"
          type="text"
          inputMode="decimal"
          aria-label="Amount"
          placeholder="0"
          autoFocus
          value={pr.amt ? groupTyped(pr.amt) : ''}
          onChange={(e) => {
            app.setPhaseRec({ ...pr, amt: sanitizeAmount(e.target.value) })
            app.clearErr()
          }}
        />
      </div>

      <div className="editor-methods" style={{ marginTop: 9 }}>
        {app.methods.map((m) => (
          <button
            key={m}
            type="button"
            className="editor-method"
            style={pick(pr.method === m)}
            aria-pressed={pr.method === m}
            onClick={() => {
              app.setPhaseRec({ ...pr, method: m })
              app.clearErr()
            }}
          >
            {app.methodName(m)}
          </button>
        ))}
      </div>

      <input
        className="field mt-9"
        type="text"
        placeholder="What was it for?"
        value={pr.note}
        onChange={(e) => app.setPhaseRec({ ...pr, note: e.target.value })}
      />
      <ChipScroller className="chips phase-rec-chips">
        {app.orderedCats.slice(0, 8).map((c) => {
          const on = pr.note.toLowerCase() === c.toLowerCase()
          return (
            <button
              key={c}
              type="button"
              className="chip"
              style={pick(on, '#fff', '#4b4f5e')}
              onClick={() => app.setPhaseRec({ ...pr, note: on ? '' : c })}
            >
              {c}
            </button>
          )
        })}
      </ChipScroller>

      <div className="date-row" style={{ borderColor: border(app, 'prday') }}>
        <span className="date-label">Which day?</span>
        <input
          className="date-input"
          type="date"
          aria-label="Day"
          min={phase.from}
          max={last}
          value={pr.day}
          onChange={(e) => {
            app.setPhaseRec({ ...pr, day: e.target.value })
            app.clearErr()
          }}
        />
      </div>
      <div className="helper" style={{ marginTop: 8 }}>
        Any day from {shortDate(phase.from)} to {last === t ? 'today' : shortDate(last)}.
      </div>

      <FormError
        message={['pramt', 'prmethod', 'prday'].includes(app.errField) ? app.formError : ''}
      />
      <div className="form-actions">
        <button type="button" className="editor-cancel" onClick={() => app.setPhaseRec(null)}>
          Cancel
        </button>
        <button
          type="button"
          className="editor-save"
          style={{ background: ACCENT, borderColor: LINE }}
          onClick={app.savePhaseRec}
        >
          Record into {phase.name}
        </button>
      </div>
    </div>
  )
}

/* ==================================================================
   Phases — a named stretch of time
================================================================== */

export function Phases({ app }: { app: App }) {
  const { data, mainCur } = app
  const form = app.phaseForm
  const phases = sortPhases(data.phases)

  return (
    <div className="page">
      <div className="helper" style={{ marginTop: 0 }}>
        A named stretch of time. Expenses fall in by date.
      </div>

      {phases.length > 0 && (
        <div className="list-card mt-14">
          {phases.map((ph) => {
            const spent = sumIn(data.rates, phaseItems(data.items, ph), mainCur)
            return (
              <div className="plan-item" key={ph.id}>
                <div className="plan-row" onClick={() => app.openPhase(ph.id)}>
                  <span className="plan-main">
                    <span className="plan-name">
                      {ph.name}
                      {ph.offBooks && <span className="phase-tag">out of totals</span>}
                    </span>
                    <span className="plan-date">
                      {shortDate(ph.from)} — {ph.to ? shortDate(ph.to) : 'now'}
                    </span>
                  </span>
                  <span className="plan-amt">{app.fmt(spent)}</span>
                  <ChevronRight size={12} color="#9497a5" />
                </div>
                {form && form.id === ph.id && <PhaseFormBox app={app} inCard />}
              </div>
            )
          })}
        </div>
      )}

      {form && form.id === null ? (
        <PhaseFormBox app={app} />
      ) : (
        <button type="button" className="extra-link mt-14" onClick={() => app.openPhaseForm()}>
          ＋ Add a phase by dates
        </button>
      )}
    </div>
  )
}

function PhaseFormBox({ app, inCard }: { app: App; inCard?: boolean }) {
  const form = app.phaseForm
  if (!form) return null

  return (
    <div className={inCard ? 'mini-form mini-form-card' : 'mini-form'}>
      <input
        className="field"
        type="text"
        placeholder="What was it? Rwanda, Back in Türkiye…"
        value={form.name}
        onChange={(e) => {
          app.setPhaseForm({ ...form, name: e.target.value })
          app.clearErr()
        }}
        style={{ borderColor: border(app, 'phname') }}
      />

      <div className="date-row" style={{ borderColor: border(app, 'phfrom') }}>
        <span className="date-label">From</span>
        <input
          className="date-input"
          type="date"
          aria-label="Phase start"
          value={form.from}
          onChange={(e) => {
            app.setPhaseForm({ ...form, from: e.target.value })
            app.clearErr()
          }}
        />
      </div>
      <div className="date-row" style={{ borderColor: border(app, 'phto') }}>
        <span className="date-label">Until</span>
        <input
          className="date-input"
          type="date"
          aria-label="Phase end"
          value={form.to}
          onChange={(e) => {
            app.setPhaseForm({ ...form, to: e.target.value })
            app.clearErr()
          }}
        />
      </div>
      <div className="helper">No Until yet? It is still going.</div>

      <FormError
        message={['phname', 'phfrom', 'phto'].includes(app.errField) ? app.formError : ''}
      />
      <div className="form-actions">
        <button type="button" className="editor-cancel" onClick={() => app.setPhaseForm(null)}>
          Cancel
        </button>
        <button
          type="button"
          className="editor-save"
          style={{ background: ACCENT, borderColor: LINE }}
          onClick={app.savePhase}
        >
          {form.id ? 'Save changes' : 'Add phase'}
        </button>
      </div>
    </div>
  )
}

/** One phase read on its own: what it cost, how long it ran, where it went. */
export function PhaseView({ app }: { app: App }) {
  const { data, mainCur } = app
  const ph = data.phases.find((p) => p.id === app.viewPhase)
  if (!ph) return <div className="page" />

  const items = phaseItems(data.items, ph)
  const spent = sumIn(data.rates, items, mainCur)
  const days = phaseDays(ph)
  const perDay = spent / days
  const cats = topCategories(data.rates, items, mainCur, (i) => i.note || app.methodName(i.method))
  const catMax = cats.length ? cats[0].value : 1
  const running = !ph.to

  return (
    <div className="page">
      <div className="headline-26">{ph.name}</div>
      <div className="forgot-note">
        {shortDate(ph.from)} — {running ? 'still going' : shortDate(ph.to)} · {days}{' '}
        {days === 1 ? 'day' : 'days'}
      </div>

      <div className="card card-month mt-14">
        <div className="label-sm">Spent in this phase</div>
        <div className="figure-42">{app.fmt(spent)}</div>
        <div className="phase-sub">
          {app.fmt(perDay)} a day · {items.length}{' '}
          {items.length === 1 ? 'expense' : 'expenses'}
        </div>
      </div>

      {/* Out of the totals: its spending stays out of "spent" and the
          breakdowns everywhere else, and is still drawn in the graphs. */}
      <div className="list-card mt-14">
        <div className="toggle-row">
          <div>
            <div className="toggle-label">Count in totals</div>
            <div className="toggle-hint">
              {ph.offBooks ? 'Off. Shown in the graphs only.' : 'On. Part of spent this month.'}
            </div>
          </div>
          <button
            type="button"
            className="toggle"
            role="switch"
            aria-checked={!ph.offBooks}
            aria-label="Count in totals"
            onClick={() => app.togglePhaseBooks(ph)}
            style={{
              background: !ph.offBooks ? ACCENT : 'rgba(20,22,31,.14)',
              justifyContent: !ph.offBooks ? 'flex-end' : 'flex-start',
            }}
          >
            <span />
          </button>
        </div>
      </div>

      {/* An expense that belongs in this phase, placed on one of its days. */}
      {app.phaseRec?.phaseId === ph.id ? (
        <PhaseRecordBox app={app} phase={ph} />
      ) : (
        <button type="button" className="extra-link mt-14" onClick={() => app.openPhaseRec(ph)}>
          ＋ Add an expense to {ph.name}
        </button>
      )}

      {items.length > 0 && (
        <>
          <div className="section-label">How it was paid</div>
          <div className="card-list">
            {app.methods.map((m, ix) => {
              const v = sumFrom(data.rates, items, m, mainCur)
              if (v <= 0) return null
              const pct = Math.round((v / (spent || 1)) * 100) + '%'
              return (
                <div className="paid-row" key={m}>
                  <div className="paid-head">
                    <span className="dot-9" style={{ background: mixColour(ix) }} />
                    <span className="paid-label">{app.methodName(m)}</span>
                    <span className="paid-sum">{app.fmt(v)}</span>
                    <span className="paid-pct">{pct}</span>
                  </div>
                  <div className="track-8">
                    <span style={{ width: pct, background: mixColour(ix) }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="section-label">By category</div>
          <div className="card-list">
            {cats.map((c, ix) => (
              <div className="paid-row" key={c.name}>
                <div className="cat-head">
                  <span className="cat-name">{c.name}</span>
                  <span className="cat-sum">{app.fmt(c.value)}</span>
                </div>
                <div className="track-7">
                  <span
                    style={{
                      width: Math.round((c.value / catMax) * 100) + '%',
                      background: ix === 0 ? ACCENT : 'rgba(20,22,31,.22)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="safety-actions mt-22">
        {running && (
          <button
            type="button"
            className="btn-set"
            style={{ background: ACCENT }}
            onClick={() => app.endPhase(ph)}
          >
            End today
          </button>
        )}
        <button type="button" className="btn-reset" onClick={() => app.openPhaseForm(ph)}>
          Edit
        </button>
      </div>
      {app.phaseForm && app.phaseForm.id === ph.id && <PhaseFormBox app={app} />}

      <button type="button" className="danger-btn" onClick={() => app.askRemovePhase(ph)}>
        Remove
      </button>
    </div>
  )
}

export type { Phase }
