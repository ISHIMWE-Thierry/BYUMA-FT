import { useEffect, useRef, useState } from 'react'
import type { App } from '../useApp'
import {
  accountBalance,
  amountIn,
  DAY,
  sumFrom,
  dayOffset,
  dayStamp,
  monthItems,
  sumIn,
  topCategories,
} from '../lib/calc'
import { MINUS } from '../lib/money'
import { ChevronRight, MICON, WarnIcon } from '../components/icons'
import { ACCENT, ChipScroller, DANGER, HideEye, VIOLET, pick } from '../components/ui'
import { mixColour } from './Home'

export function CurrencyTabs({ app, flush }: { app: App; flush?: boolean }) {
  return (
    <div className={flush ? 'cur-tabs cur-tabs-flush' : 'cur-tabs'}>
      {app.selCurs.map((c) => (
        <button
          key={c}
          type="button"
          className="cur-tab"
          style={pick(c === app.activeCur, '#fff', '#4b4f5e')}
          onClick={() => app.setBalCur(c)}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

export function Stats({ app }: { app: App }) {
  const { data, activeCur, balance, plansOff, safetyOff, incomeIn, spend, mainCur, selCurs } = app
  const rates = data.rates

  // Last months: the design's bars, or a line that records every single day.
  const [monthsView, setMonthsView] = useState<'bars' | 'graph'>('bars')

  const red = app.shortfall > 0
  const violet = !red && spend < 0

  // Each figure hides on its own: the balance card and This month keep
  // separate eyes, and the breakdowns below stay readable either way.
  const { hideBal, hideMonth } = data.settings
  const m = (s: string) => (hideBal ? '••••••' : s)

  const cells = [
    { label: 'Balance', text: app.fmtIn(balance, activeCur), color: '#4b4f5e' },
    { label: 'Plans', text: MINUS + ' ' + app.fmtIn(plansOff, activeCur), color: DANGER },
    { label: 'Safety net', text: MINUS + ' ' + app.fmtIn(safetyOff, activeCur), color: VIOLET },
    ...(incomeIn > 0
      ? [{ label: 'Income counted', text: '+ ' + app.fmtIn(incomeIn, activeCur), color: ACCENT }]
      : []),
  ]

  // Totals leave out any phase kept off the books; the day strips below
  // draw everything.
  const counted = app.counted
  const month = monthItems(counted)
  const monthTotal = sumIn(rates, month, mainCur)
  const total = sumIn(rates, counted, mainCur) || 1

  const cats = topCategories(rates, counted, mainCur, (i) => i.note || app.methodName(i.method))
  const catMax = cats.length ? cats[0].value : 1

  const byAccount = data.settings.balanceBy === 'account' && data.balancesAt > 0
  const checkups = data.checkups.slice(0, 6)

  return (
    <div className="page">
      <div className="headline-30">Where the money went</div>

      <CurrencyTabs app={app} />

      {/* ---------------- the balance card ---------------- */}
      <div className="card card-balance">
        <div className="label-eye">
          <span className="label-sm">Spendable</span>
          <HideEye hidden={hideBal} onToggle={() => app.setSetting('hideBal')} />
        </div>
        <div
          className="figure-42"
          style={{ color: red ? DANGER : violet ? VIOLET : '#14161f' }}
        >
          {m(app.fmtIn(spend, activeCur))}
        </div>

        <div className="bal-rows">
          {cells.map((b) => (
            <div className="bal-row" key={b.label}>
              <span className="dot-7" style={{ background: b.color }} />
              <span className="bal-label">{b.label}</span>
              <span className="bal-value">{m(b.text)}</span>
            </div>
          ))}
        </div>

        {(red || violet) && (
          <div
            className="bal-warn"
            style={{ background: red ? 'rgba(180,85,58,.09)' : 'rgba(123,94,199,.1)' }}
          >
            <span style={{ display: 'flex' }}>
              <WarnIcon color={red ? DANGER : VIOLET} />
            </span>
            <span style={{ color: red ? DANGER : VIOLET }}>
              {red
                ? 'Under your P1 plans by ' + app.fmtIn(app.shortfall, activeCur) + '.'
                : safetyOff > 0
                  ? 'Eating into your safety net.'
                  : 'Your plans leave nothing spare.'}
            </span>
          </div>
        )}

        <div className="card-footer">
          <button type="button" className="card-footer-btn" onClick={() => app.goBalance('stats')}>
            Update balance
            <ChevronRight />
          </button>
          <span className="card-footer-divider" />
          <button type="button" className="card-footer-btn" onClick={app.goPlans}>
            Plans
            <ChevronRight />
          </button>
          <span className="card-footer-divider" />
          <button type="button" className="card-footer-btn" onClick={app.goPhases}>
            Phases
            <ChevronRight />
          </button>
        </div>
      </div>

      {/* ---------------- where the money is ---------------- */}
      {byAccount && (
        <>
          <div className="section-label">Where the money is</div>
          <div className="card-list">
            {data.accounts.map((a) => {
              const Icon = MICON[a.kind]
              const held = accountBalance(rates, data.balances, a.id, selCurs, activeCur)
              return (
                <div className="acc-line" key={a.id}>
                  <span className="acc-tile">
                    <Icon />
                  </span>
                  <span className="acc-line-name">{a.name}</span>
                  <span className="acc-line-sum">{m(app.fmtIn(held, activeCur))}</span>
                </div>
              )
            })}
            <div className="helper" style={{ margin: '10px 0 4px' }}>
              As of the last check-up. Spending since comes off the total above.
            </div>
          </div>
        </>
      )}

      {/* ---------------- check-ups ---------------- */}
      {checkups.length > 0 && (
        <>
          <div className="section-label">Check-ups</div>
          <div className="card-list">
            {checkups.map((c) => {
              const moved = selCurs.filter((cur) => Math.round(c.diff[cur] ?? 0) !== 0)
              return (
                <div className="checkup-row" key={c.id}>
                  <span className="checkup-date">{dayStamp(c.at)}</span>
                  <span className="checkup-diff">
                    {moved.length === 0
                      ? 'matched the records'
                      : moved.map((cur) => (
                          <span
                            key={cur}
                            className="checkup-amt"
                            style={{ color: c.diff[cur] > 0 ? '#1f7a5c' : DANGER }}
                          >
                            {(c.diff[cur] > 0 ? '+' : MINUS) +
                              app.fmtIn(Math.abs(c.diff[cur]), cur)}
                          </span>
                        ))}
                  </span>
                </div>
              )
            })}
            <div className="helper" style={{ margin: '10px 0 4px' }}>
              What moved without a record: minus is unrecorded spending, plus is money that came in.
            </div>
          </div>
        </>
      )}

      {/* ---------------- this month ---------------- */}
      <div className="card card-month">
        <div className="label-eye">
          <span className="label-sm">Spent this month</span>
          <HideEye hidden={hideMonth} onToggle={() => app.setSetting('hideMonth')} />
        </div>
        <div className="figure-42">{hideMonth ? '••••••' : app.fmt(monthTotal)}</div>
      </div>

      {/* ---------------- how it was paid ---------------- */}
      <div className="section-label">How it was paid</div>
      <div className="card-list">
        {app.methods.map((mt, ix) => {
          const v = sumFrom(rates, counted, mt, mainCur)
          const pct = Math.round((v / total) * 100) + '%'
          return (
            <div className="paid-row" key={mt}>
              <div className="paid-head">
                <span className="dot-9" style={{ background: mixColour(ix) }} />
                <span className="paid-label">{app.methodName(mt)}</span>
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

      {/* ---------------- by category ---------------- */}
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

      {/* ---------------- day by day ---------------- */}
      <div className="section-head">
        <span className="section-label">Day by day</span>
        <div className="seg-mini">
          <button
            type="button"
            className="seg-btn"
            style={pick(monthsView === 'bars', '#fff', '#4b4f5e')}
            onClick={() => setMonthsView('bars')}
          >
            Bars
          </button>
          <button
            type="button"
            className="seg-btn"
            style={pick(monthsView === 'graph', '#fff', '#4b4f5e')}
            onClick={() => setMonthsView('graph')}
          >
            Graph
          </button>
        </div>
      </div>
      <div className="card-months">
        {monthsView === 'bars' ? <DayBars app={app} /> : <DayGraph app={app} />}
      </div>
    </div>
  )
}

/** Every day since the first recorded one, summed in the main currency. */
function dailySeries(app: App) {
  const { items } = app.data
  const now = Date.now()
  const span = items.length
    ? Math.max(...items.map((i) => dayOffset(i.at, now))) + 1
    : 1
  const daily = new Array<number>(span).fill(0)
  for (const i of items) {
    const off = dayOffset(i.at, now)
    if (off >= 0 && off < span) {
      daily[span - 1 - off] += amountIn(app.data.rates, i, app.mainCur)
    }
  }
  return { now, span, daily, max: Math.max(...daily, 1) }
}

// One day of horizontal room; a week and a bit fills a phone's view.
const DAY_W = 38

/**
 * The marks under a strip: the first tick and every 1st name the month.
 * `mark` is the emphasized day — today unless a bar was picked.
 */
function DayTicks({ now, span, mark }: { now: number; span: number; mark?: number }) {
  const strong = mark ?? span - 1
  return (
    <div className="day-ticks">
      {Array.from({ length: span }, (_, ix) => {
        const at = now - (span - 1 - ix) * DAY
        const d = new Date(at)
        const label =
          ix === 0 || d.getDate() === 1 ? dayStamp(at, now) : String(d.getDate())
        return (
          <span key={ix} className={ix === strong ? 'day-tick-today' : undefined}>
            {label}
          </span>
        )
      })}
    </div>
  )
}

/**
 * One bar per day: 14 August is its own bar, 15 August the next. The strip
 * starts at the first recorded day, grows a day at a time, opens docked at
 * today, and slides under the card's edge with a fade on the side holding
 * more days. One shared scale keeps every day comparable.
 *
 * Tapping a bar reads that day: it takes the accent, its amount appears
 * above it, and its tick goes bold. The row is tall enough that the figure
 * always has its headroom, so nothing shifts when it appears. Today plays
 * that role until another day is picked.
 */
function DayBars({ app }: { app: App }) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const hideMonth = app.data.settings.hideMonth
  const { now, span, daily, max } = dailySeries(app)

  // null means today; a number is a day the person tapped to read.
  const [picked, setPicked] = useState<number | null>(null)
  const sel = picked === null || picked >= span ? span - 1 : picked

  // Open at today.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [span])

  return (
    <ChipScroller
      className="day-scroll day-scroll-bars"
      scrollRef={(el) => {
        scroller.current = el
      }}
    >
      <div style={{ width: (span * DAY_W) / 10 + 'rem' }}>
        <div className="bar-row">
          {daily.map((v, ix) => (
            <button
              type="button"
              className="bar-col"
              key={ix}
              aria-label={dayStamp(now - (span - 1 - ix) * DAY, now)}
              aria-pressed={ix === sel}
              onClick={() => setPicked(ix === span - 1 ? null : ix)}
            >
              {ix === sel && (
                <span className="month-figure">{hideMonth ? '•••' : app.fmt(v)}</span>
              )}
              <span
                className="month-bar"
                style={{
                  // Inline styles skip the build's px-to-rem step, so the
                  // design's px are converted here (1rem = 10 design px).
                  height: Math.max(6, Math.round((v / max) * 130)) / 10 + 'rem',
                  background:
                    ix === sel
                      ? ACCENT
                      : ix === span - 1
                        ? 'rgba(59,69,201,.35)'
                        : 'rgba(20,22,31,.15)',
                }}
              />
            </button>
          ))}
        </div>
        <DayTicks now={now} span={span} mark={sel} />
      </div>
    </ChipScroller>
  )
}

/**
 * The same days as a line: one point per day, so the growth and the fall
 * read as a single path. Same width per day, same docking, same fade.
 */
function DayGraph({ app }: { app: App }) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const { now, span, daily, max } = dailySeries(app)

  const BASE = 124
  const width = span * DAY_W
  const x = (ix: number) => ix * DAY_W + DAY_W / 2
  const y = (v: number) => Math.round((BASE - (v / max) * (BASE - 16)) * 10) / 10
  const pts = daily.map((v, ix) => x(ix) + ',' + y(v)).join(' ')

  // Open at the newest day.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [span])

  return (
    <ChipScroller
      className="day-scroll day-scroll-line"
      scrollRef={(el) => {
        scroller.current = el
      }}
    >
      <div style={{ width: width / 10 + 'rem' }}>
        <svg
          className="day-line"
          viewBox={'0 0 ' + width + ' 140'}
          style={{ width: width / 10 + 'rem', height: '14rem' }}
          role="img"
          aria-label="Spending per day since the first recorded expense"
        >
          <polygon
            points={x(0) + ',' + BASE + ' ' + pts + ' ' + x(span - 1) + ',' + BASE}
            fill="rgba(59,69,201,.08)"
          />
          <polyline
            points={pts}
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {daily.map((v, ix) => (
            <circle
              key={ix}
              cx={x(ix)}
              cy={y(v)}
              r={ix === span - 1 ? 4.5 : 3}
              fill={ix === span - 1 ? ACCENT : '#fff'}
              stroke={ACCENT}
              strokeWidth="1.6"
            />
          ))}
        </svg>
        <DayTicks now={now} span={span} />
      </div>
    </ChipScroller>
  )
}
