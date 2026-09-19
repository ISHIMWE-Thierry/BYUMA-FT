import { useRef, useState } from 'react'
import type { App } from '../useApp'
import type { Account, Method, Phase } from '../types'
import {
  accountBalance,
  phaseDays,
  phaseItems,
  shortDate,
  sortPhases,
  sumFrom,
  sumIn,
  topCategories,
} from '../lib/calc'
import { isStandard, STANDARD } from '../lib/storage'
import { ACCENT, DANGER, FormError, LINE, pick } from '../components/ui'
import { ChevronRight, CrossIcon, MICON } from '../components/icons'
import { mixColour } from './Home'

const border = (app: App, field: string) => (app.errField === field ? DANGER : LINE)

const KINDS: { k: Method; label: string }[] = [
  { k: 'bank', label: 'Bank' },
  { k: 'cash', label: 'Cash' },
  { k: 'momo', label: 'Phone' },
]

/* ==================================================================
   Accounts — where the money sits
================================================================== */

export function Accounts({ app }: { app: App }) {
  const { data, selCurs, activeCur, accounts } = app
  const form = app.accForm
  const missing = STANDARD.filter((s) => !accounts.some((a) => a.id === s.id))

  return (
    <div className="page">
      <div className="helper" style={{ marginTop: 0 }}>
        An account is somewhere your money sits. Every expense comes out of
        one, and what is left in each is what adds up to your balance.
      </div>

      <div className="list-card mt-14">
        {accounts.map((a) => {
          const Icon = MICON[a.kind]
          const held = accountBalance(data.rates, data.balances, a.id, selCurs, activeCur)
          return (
            <div className="plan-item" key={a.id}>
              <div className="plan-row" onClick={() => app.openAccForm(a)}>
                <span className="acc-tile">
                  <Icon />
                </span>
                <span className="plan-main">
                  <span className="plan-name">{a.name}</span>
                  {isStandard(a.id) && <span className="plan-date">standard</span>}
                </span>
                <span className="plan-amt">{app.fmtIn(held, activeCur)}</span>
                <button
                  type="button"
                  className="x-btn"
                  aria-label={'Remove ' + a.name}
                  onClick={(e) => {
                    e.stopPropagation()
                    app.askRemoveAcc(a)
                  }}
                >
                  <CrossIcon />
                </button>
              </div>
              {form && form.id === a.id && <AccFormBox app={app} inCard />}
            </div>
          )
        })}
      </div>

      {/* The three standard ones can be put back at any time. Naming your
          own is what Pro adds on top of them. */}
      {missing.length > 0 && (
        <div className="pick-row mt-14">
          {missing.map((s) => (
            <button
              key={s.id}
              type="button"
              className="pick-chip"
              style={pick(false, '#faf9fc', '#4b4f5e')}
              onClick={() => app.addStandard(s.id)}
            >
              ＋ {s.name}
            </button>
          ))}
        </div>
      )}

      {app.pro ? (
        form && form.id === null ? (
          <AccFormBox app={app} />
        ) : (
          <button type="button" className="extra-link mt-14" onClick={() => app.openAccForm()}>
            ＋ Add an account
          </button>
        )
      ) : (
        <div className="helper">
          Byuma Pro lets you name your own — Ziraat, Albaraka, a drawer at
          home — instead of only the three above.
        </div>
      )}
    </div>
  )
}

export function AccFormBox({ app, inCard }: { app: App; inCard?: boolean }) {
  const form = app.accForm
  if (!form) return null
  const standard = form.id !== null && isStandard(form.id)

  return (
    <div className={inCard ? 'mini-form mini-form-card' : 'mini-form'}>
      <input
        className="field"
        type="text"
        placeholder="What is it? Ziraat, Albaraka…"
        value={form.name}
        disabled={standard}
        onChange={(e) => {
          app.setAccForm({ ...form, name: e.target.value })
          app.clearErr()
        }}
        style={{ borderColor: border(app, 'accname') }}
      />
      {standard && (
        <div className="helper">
          The three standard accounts keep their names. Add your own to name
          it yourself.
        </div>
      )}

      <div className="prio-seg">
        {KINDS.map(({ k, label }) => {
          const Icon = MICON[k]
          return (
            <button
              key={k}
              type="button"
              className="prio-btn"
              style={pick(form.kind === k, '#faf9fc', '#4b4f5e')}
              onClick={() => app.setAccForm({ ...form, kind: k })}
            >
              <span style={{ display: 'flex' }}>
                <Icon />
              </span>
              <span className="prio-btn-word">{label}</span>
            </button>
          )
        })}
      </div>

      <FormError message={app.errField === 'accname' ? app.formError : ''} />
      <div className="form-actions">
        <button type="button" className="editor-cancel" onClick={() => app.setAccForm(null)}>
          Cancel
        </button>
        <button
          type="button"
          className="editor-save"
          style={{ background: ACCENT, borderColor: LINE }}
          onClick={app.saveAcc}
        >
          {form.id ? 'Save changes' : 'Add account'}
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
        A phase is a stretch of time with a name — where you were, what you
        were doing. Expenses fall into one by their date, so a phase can be
        drawn around days already lived.
      </div>

      {phases.length > 0 && (
        <div className="list-card mt-14">
          {phases.map((ph) => {
            const spent = sumIn(data.rates, phaseItems(data.items, ph), mainCur)
            return (
              <div className="plan-item" key={ph.id}>
                <div className="plan-row" onClick={() => app.openPhase(ph.id)}>
                  <span className="plan-main">
                    <span className="plan-name">{ph.name}</span>
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
          ＋ Add a phase
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
      <div className="helper">Leave Until empty while the phase is still going.</div>

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
  const cats = topCategories(data.rates, items, mainCur, (i) => i.note || app.accName(i.acc))
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

      {items.length > 0 && (
        <>
          <div className="section-label">Where it came from</div>
          <div className="card-list">
            {app.accounts.map((a, ix) => {
              const v = sumFrom(data.rates, items, a.id, mainCur)
              if (v <= 0) return null
              const pct = Math.round((v / (spent || 1)) * 100) + '%'
              return (
                <div className="paid-row" key={a.id}>
                  <div className="paid-head">
                    <span className="dot-9" style={{ background: mixColour(ix) }} />
                    <span className="paid-label">{a.name}</span>
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
            End it today
          </button>
        )}
        <button type="button" className="btn-reset" onClick={() => app.openPhaseForm(ph)}>
          Edit
        </button>
      </div>
      {app.phaseForm && app.phaseForm.id === ph.id && <PhaseFormBox app={app} />}

      <button type="button" className="danger-btn" onClick={() => app.askRemovePhase(ph)}>
        Remove this phase
      </button>
    </div>
  )
}

/* ==================================================================
   The Pro tour
================================================================== */

const SLIDES = [
  {
    title: 'Name where your money is.',
    body: 'Cash and Bank become Ziraat, Albaraka, a drawer at home — whatever you actually use. Each one holds its own balance.',
  },
  {
    title: 'Name your seasons.',
    body: 'A phase is a stretch of time with a name. In History, hold the first expense and tap the last — that run becomes a phase.',
  },
  {
    title: 'Nothing is ever lost.',
    body: 'Turn Pro off whenever you like. Your accounts and phases stay exactly as they are, just out of the way.',
  },
]

function ArtAccounts() {
  return (
    <div className="tm-card tm-float">
      {[
        { name: 'Ziraat', kind: 'bank' as Method, amt: '12,400 TL' },
        { name: 'Albaraka', kind: 'bank' as Method, amt: '3,900 TL' },
        { name: 'Cash', kind: 'cash' as Method, amt: '40,000 RWF' },
      ].map((a, ix) => {
        const Icon = MICON[a.kind]
        return (
          <div className={'tm-plan tm-pop tm-d' + (ix + 1)} key={a.name}>
            <span className="tm-badge" style={{ color: ACCENT, borderColor: ACCENT }}>
              <Icon />
            </span>
            <span className="tm-plan-name">{a.name}</span>
            <span className="tm-plan-amt">{a.amt}</span>
          </div>
        )
      })}
    </div>
  )
}

function ArtPhases() {
  return (
    <div className="tm-card tm-float">
      <span className="tm-label">Phases</span>
      <div className="tm-plan tm-pop tm-d1">
        <span className="tm-plan-name">Rwanda</span>
        <span className="tm-plan-amt">1 Jun — 2 Sep</span>
      </div>
      <div className="tm-plan tm-pop tm-d2">
        <span className="tm-plan-name">Back in Türkiye</span>
        <span className="tm-plan-amt">now</span>
      </div>
      <div className="tm-spend tm-pop tm-d3">
        <span>In Rwanda</span>
        <span className="tm-spend-val">RWF 486,000</span>
      </div>
    </div>
  )
}

function ArtKept() {
  return (
    <div className="tm-card tm-float">
      <span className="tm-label">Pro features</span>
      <div className="count-row" style={{ marginTop: 12 }}>
        <span className="tm-plan-name">On</span>
        <span className="tm-switch tm-pop tm-d1" style={{ background: ACCENT }}>
          <span />
        </span>
      </div>
      <div className="tm-spend tm-pop tm-d2">
        <span>Your accounts and phases</span>
        <span className="tm-spend-val">kept</span>
      </div>
    </div>
  )
}

const ARTS = [ArtAccounts, ArtPhases, ArtKept]

/**
 * The same shape as the first-run tour, for the features Pro adds. It is
 * where turning Pro on lands, and Profile keeps a way back to it.
 */
export function ProTour({ app }: { app: App }) {
  const track = useRef<HTMLDivElement>(null)
  const [ix, setIx] = useState(0)
  const last = ix === SLIDES.length - 1

  const onScroll = () => {
    const el = track.current
    if (!el) return
    setIx(Math.min(SLIDES.length - 1, Math.round(el.scrollLeft / el.clientWidth)))
  }

  const next = () => {
    if (last) {
      if (!app.pro) app.setPro(true)
      app.go('profile')
      return
    }
    const el = track.current
    el?.scrollTo({ left: (ix + 1) * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="tour">
      <div className="tour-top">
        <span className="wordmark">Byuma Pro</span>
        <span className="tour-count">
          {ix + 1} of {SLIDES.length}
        </span>
        <button type="button" className="tour-skip" onClick={() => app.go('profile')}>
          {app.pro ? 'Done' : 'Not now'}
        </button>
      </div>

      <div className="tour-track" ref={track} onScroll={onScroll}>
        {SLIDES.map((s, k) => {
          const Art = ARTS[k]
          return (
            <div className="tour-slide" key={s.title}>
              <div className="tour-art">
                <Art key={k === ix ? 'live' : 'still'} />
              </div>
              <div className="tour-title">{s.title}</div>
              <div className="tour-body">{s.body}</div>
            </div>
          )
        })}
      </div>

      <div className="tour-dots">
        {SLIDES.map((s, k) => (
          <span
            key={s.title}
            className={k === ix ? 'tour-dot tour-dot-on' : 'tour-dot'}
            style={k === ix ? { background: ACCENT } : undefined}
          />
        ))}
      </div>

      <div className="tour-foot">
        <button
          type="button"
          className="btn-primary"
          style={{ background: ACCENT }}
          onClick={next}
        >
          {last ? (app.pro ? 'Done' : 'Turn Pro on') : 'Next'}
        </button>
      </div>
    </div>
  )
}

export type { Account, Phase }
