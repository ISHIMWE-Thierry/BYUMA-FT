import { useState } from 'react'
import type { App } from '../useApp'
import type { Income, Plan, Prio } from '../types'
import { accountBalance, shortDate } from '../lib/calc'
import { clean, groupTyped, MINUS } from '../lib/money'
import { convert, estRate } from '../lib/rates'
import { ChipScroller, DANGER, FormError, LINE, pick } from '../components/ui'
import { ACCENT } from '../components/ui'
import { CrossIcon, EyeIcon, EyeOffIcon, InfoIcon, MICON } from '../components/icons'
import { isStandard, STANDARD } from '../lib/storage'
import { AccFormBox } from './Pro'

const border = (app: App, field: string) => (app.errField === field ? DANGER : LINE)

/**
 * The accounts, where the balance is: which are offered when recording, one
 * to put back, one to name (Pro). Hiding one keeps it off the recorder's
 * row and nothing else — its history and its balance stay.
 */
function AccountsArea({ app }: { app: App }) {
  const { accounts } = app
  const form = app.accForm
  const missing = STANDARD.filter((s) => !accounts.some((a) => a.id === s.id))

  return (
    <div className="acc-area">
      <div className="section-head">
        <span className="section-label">Accounts</span>
        <span className="section-total">{accounts.length}</span>
      </div>
      <div className="list-card">
        {accounts.map((a) => {
          const Icon = MICON[a.kind]
          return (
            <div className="plan-item" key={a.id}>
              <div className="acc-row">
                <span className="acc-tile" style={{ opacity: a.hidden ? 0.45 : 1 }}>
                  <Icon />
                </span>
                {/* With Pro a tap on the name renames it; the new name is
                    what the recorder then shows. */}
                <span
                  className="plan-main"
                  style={{ opacity: a.hidden ? 0.55 : 1, cursor: app.pro ? 'pointer' : 'default' }}
                  onClick={app.pro ? () => app.openAccForm(a) : undefined}
                >
                  <span className="plan-name">{a.name}</span>
                  <span className="plan-date">
                    {a.hidden
                      ? 'off the recorder'
                      : app.pro
                        ? 'tap to rename'
                        : isStandard(a.id)
                          ? 'standard'
                          : 'yours'}
                  </span>
                </span>
                <button
                  type="button"
                  className="acc-eye"
                  aria-label={(a.hidden ? 'Show ' : 'Hide ') + a.name}
                  onClick={() => app.toggleHideAcc(a)}
                >
                  {a.hidden ? <EyeOffIcon /> : <EyeIcon />}
                </button>
                <button
                  type="button"
                  className="x-btn"
                  aria-label={'Remove ' + a.name}
                  onClick={() => app.askRemoveAcc(a)}
                >
                  <CrossIcon />
                </button>
              </div>
              {app.pro && form && form.id === a.id && <AccFormBox app={app} inCard />}
            </div>
          )
        })}
      </div>

      {(missing.length > 0 || app.pro) && (
        <div className="pick-row" style={{ flexWrap: 'wrap' }}>
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
          {app.pro && !form && (
            <button
              type="button"
              className="pick-chip"
              style={pick(false, '#faf9fc', '#4b4f5e')}
              onClick={() => app.openAccForm()}
            >
              ＋ Your own
            </button>
          )}
        </div>
      )}
      {app.pro && form && form.id === null && <AccFormBox app={app} />}
    </div>
  )
}

export function Balance({ app }: { app: App }) {
  const { data, selCurs, mainCur, extra, accounts } = app
  const others = data.allCurs.filter((c) => !selCurs.includes(c))
  const rateRows = selCurs.filter((c) => c !== mainCur)

  // A save made before accounts existed put everything under Cash, because
  // it never recorded where the money was. Said once, here, where it can be
  // put right in a few taps.
  const onlyCash =
    accounts.length > 1 &&
    Object.entries(data.balances).every(
      ([id, held]) =>
        id === 'cash' || !Object.values(held ?? {}).some((v) => v !== 0),
    ) &&
    Object.values(data.balances.cash ?? {}).some((v) => v !== 0)

  return (
    <div className="page">
      <div className="headline-26">What do you have now?</div>

      {onlyCash && (
        <div className="helper mt-9">
          Everything is under Cash, which is where an older version kept it.
          Move what is really in the bank onto Bank.
        </div>
      )}

      <AccountsArea app={app} />

      {/* One block per account, each holding its own currencies. */}
      {accounts.map((a) => (
        <div className="bal-acc" key={a.id}>
          <div className="section-head">
            <span className="section-label">{a.name}</span>
            <span className="section-total">
              {app.fmtIn(
                accountBalance(data.rates, data.balances, a.id, selCurs, app.activeCur),
                app.activeCur,
              )}
            </span>
          </div>
          <div className="bal-inputs">
            {selCurs.map((c) => {
              const key = a.id + '|' + c
              return (
                <div
                  className="money-row"
                  key={key}
                  style={{ borderColor: border(app, 'bal' + key) }}
                >
                  <span className="money-code">{c}</span>
                  <input
                    className="money-input"
                    type="text"
                    inputMode="decimal"
                    aria-label={a.name + ' ' + c + ' total'}
                    placeholder="0"
                    value={app.fBal[key] ? groupTyped(app.fBal[key]) : ''}
                    onChange={(e) => {
                      app.setFBal({ ...app.fBal, [key]: clean(e.target.value) })
                      app.clearErr()
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <FormError message={app.formError} />

      {rateRows.length > 0 && (
        <div className="rates-card">
          <div className="label-sm">Rates</div>
          {rateRows.map((c) => (
            <div className="rate-row" key={c}>
              <span className="rate-row-label">1 {c} =</span>
              <input
                className="rate-input"
                type="text"
                inputMode="decimal"
                aria-label={'Rate for ' + c}
                value={app.shownRate(c)}
                onChange={(e) => app.editRate(c, e.target.value)}
              />
              <span className="rate-unit">{mainCur}</span>
            </div>
          ))}
        </div>
      )}

      {!extra ? (
        <button type="button" className="extra-link" onClick={app.openExtra}>
          ＋ Add from another currency
        </button>
      ) : (
        <div className="extra-card">
          <ChipScroller className="extra-chips">
            {others.map((c) => (
              <button
                key={c}
                type="button"
                className="extra-chip"
                style={pick(extra.cur === c, '#faf9fc', '#4b4f5e')}
                onClick={() =>
                  app.setExtra({
                    cur: c,
                    amt: extra.amt,
                    rate: String(estRate(data.rates, c, mainCur)),
                  })
                }
              >
                {c}
              </button>
            ))}
          </ChipScroller>

          <div className="extra-amt">
            <span className="extra-amt-code">{extra.cur}</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label={'Amount in ' + extra.cur}
              placeholder="0"
              value={extra.amt ? groupTyped(extra.amt) : ''}
              onChange={(e) => {
                app.setExtra({ ...extra, amt: clean(e.target.value) })
                app.clearErr()
              }}
            />
          </div>

          <div
            className="extra-rate"
            style={{ borderColor: border(app, 'exrate') }}
          >
            <span className="extra-rate-label">1 {extra.cur} =</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label="Rate"
              value={extra.rate}
              onChange={(e) => {
                app.setExtra({ ...extra, rate: clean(e.target.value) })
                app.clearErr()
              }}
            />
            <span className="extra-rate-unit">{mainCur}</span>
          </div>

          <div className="extra-foot">
            <span className="extra-preview">
              Adds ≈{' '}
              {app.fmtIn(
                (Number(extra.amt) || 0) * (Number(extra.rate) || 0),
                mainCur,
              )}
            </span>
            <button
              type="button"
              className="extra-remove"
              onClick={() => app.setExtra(null)}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <div className="helper">Replaces the old totals. Rates are estimates you can edit.</div>

      <button
        type="button"
        className="btn-save"
        style={{ background: ACCENT }}
        onClick={app.saveBalance}
      >
        Save
      </button>
    </div>
  )
}

/** Currency chips inside a form — only shown when there is a choice. */
function CurPick({
  curs,
  value,
  onPick,
}: {
  curs: string[]
  value: string
  onPick: (c: string) => void
}) {
  if (curs.length < 2) return null
  return (
    <div className="pick-row">
      {curs.map((c) => (
        <button
          key={c}
          type="button"
          className="pick-chip"
          style={pick(c === value, '#faf9fc', '#4b4f5e')}
          onClick={() => onPick(c)}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

/**
 * A section's one-line header: the label, an (i) that folds a short
 * explanation in and out, and the section's own total on the right.
 */
function SectionHead({
  label,
  total,
  note,
  open,
  onInfo,
}: {
  label: string
  total: string
  note: string
  open: boolean
  onInfo: () => void
}) {
  return (
    <>
      <div className="section-head">
        <span className="section-label">{label}</span>
        <button
          type="button"
          className="info-btn"
          aria-label={'About ' + label.toLowerCase()}
          aria-expanded={open}
          onClick={onInfo}
        >
          <InfoIcon />
        </button>
        {total !== '' && <span className="section-total">{total}</span>}
      </div>
      {open && <div className="info-note">{note}</div>}
    </>
  )
}

function DateRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="date-row">
      <span className="date-label">Around when?</span>
      <input
        className="date-input"
        type="date"
        aria-label="Estimated date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

const PRIO_WORDS: { p: Prio; word: string }[] = [
  { p: 1, word: 'all of it' },
  { p: 2, word: 'half' },
  { p: 3, word: 'a fifth' },
]

const PRIO_COLOR: Record<Prio, string> = { 1: DANGER, 2: '#7b5ec7', 3: '#8f92a0' }

// A missing date sorts last, so the vague plans sink below the dated ones.
const byPlan = (a: Plan, b: Plan) =>
  a.prio - b.prio || (a.date || '￿').localeCompare(b.date || '￿')
const byWhen = (a: Income, b: Income) =>
  (a.date || '￿').localeCompare(b.date || '￿')

/** The plan form. Drops in under the row being edited, or under the add link. */
function PlanFormBox({ app, inCard }: { app: App; inCard?: boolean }) {
  const pf = app.planForm
  if (!pf) return null
  return (
    <div className={inCard ? 'mini-form mini-form-card' : 'mini-form'}>
      <input
        className="field"
        type="text"
        placeholder="What is it? Rent, school fees…"
        value={pf.name}
        onChange={(e) => {
          app.setPlanForm({ ...pf, name: e.target.value })
          app.clearErr()
        }}
        style={{ borderColor: border(app, 'pname') }}
      />
      <div className="money-row mt-9" style={{ borderColor: border(app, 'pamt') }}>
        <span className="money-code">{pf.cur}</span>
        <input
          className="money-input"
          type="text"
          inputMode="decimal"
          aria-label="Amount"
          placeholder="0"
          value={pf.amt ? groupTyped(pf.amt) : ''}
          onChange={(e) => {
            app.setPlanForm({ ...pf, amt: clean(e.target.value) })
            app.clearErr()
          }}
        />
      </div>
      <CurPick curs={app.selCurs} value={pf.cur} onPick={(c) => app.setPlanForm({ ...pf, cur: c })} />

      <div className="prio-seg">
        {PRIO_WORDS.map(({ p, word }) => (
          <button
            key={p}
            type="button"
            className="prio-btn"
            style={pick(pf.prio === p, '#faf9fc', '#4b4f5e')}
            onClick={() => app.setPlanForm({ ...pf, prio: p })}
          >
            <span className="prio-btn-p">P{p}</span>
            <span className="prio-btn-word">{word}</span>
          </button>
        ))}
      </div>

      <DateRow value={pf.date} onChange={(v) => app.setPlanForm({ ...pf, date: v })} />
      <FormError message={['pname', 'pamt'].includes(app.errField) ? app.formError : ''} />
      <div className="form-actions">
        <button type="button" className="editor-cancel" onClick={() => app.setPlanForm(null)}>
          Cancel
        </button>
        <button
          type="button"
          className="editor-save"
          style={{ background: ACCENT, borderColor: LINE }}
          onClick={app.savePlan}
        >
          {pf.id ? 'Save changes' : 'Add plan'}
        </button>
      </div>
    </div>
  )
}

/** The income form, same shape, plus the count-it-in switch. */
function IncomeFormBox({ app, inCard }: { app: App; inCard?: boolean }) {
  const inf = app.incomeForm
  if (!inf) return null
  return (
    <div className={inCard ? 'mini-form mini-form-card' : 'mini-form'}>
      <input
        className="field"
        type="text"
        placeholder="Where from? Salary, a client…"
        value={inf.name}
        onChange={(e) => {
          app.setIncomeForm({ ...inf, name: e.target.value })
          app.clearErr()
        }}
        style={{ borderColor: border(app, 'iname') }}
      />
      <div className="money-row mt-9" style={{ borderColor: border(app, 'iamt') }}>
        <span className="money-code">{inf.cur}</span>
        <input
          className="money-input"
          type="text"
          inputMode="decimal"
          aria-label="Amount"
          placeholder="0"
          value={inf.amt ? groupTyped(inf.amt) : ''}
          onChange={(e) => {
            app.setIncomeForm({ ...inf, amt: clean(e.target.value) })
            app.clearErr()
          }}
        />
      </div>
      <CurPick curs={app.selCurs} value={inf.cur} onPick={(c) => app.setIncomeForm({ ...inf, cur: c })} />
      <DateRow value={inf.date} onChange={(v) => app.setIncomeForm({ ...inf, date: v })} />

      <div className="count-row">
        <span className="toggle-label">Count it in already</span>
        <button
          type="button"
          className="toggle"
          role="switch"
          aria-checked={inf.counted}
          aria-label="Count it in already"
          onClick={() => app.setIncomeForm({ ...inf, counted: !inf.counted })}
          style={{
            background: inf.counted ? ACCENT : 'rgba(20,22,31,.14)',
            justifyContent: inf.counted ? 'flex-end' : 'flex-start',
          }}
        >
          <span />
        </button>
      </div>

      <FormError message={['iname', 'iamt'].includes(app.errField) ? app.formError : ''} />
      <div className="form-actions">
        <button type="button" className="editor-cancel" onClick={() => app.setIncomeForm(null)}>
          Cancel
        </button>
        <button
          type="button"
          className="editor-save"
          style={{ background: ACCENT, borderColor: LINE }}
          onClick={app.saveIncome}
        >
          {inf.id ? 'Save changes' : 'Add income'}
        </button>
      </div>
    </div>
  )
}

/**
 * Plans, the safety net, and expected income — the three dials behind
 * spendable, each its own section with its total on the right and an (i)
 * holding the one-line explanation. Editing drops the form in right under
 * the row it belongs to.
 */
export function PlansScreen({ app }: { app: App }) {
  const { data, selCurs, activeCur } = app
  const rates = data.rates
  const pf = app.planForm
  const inf = app.incomeForm
  const plans = data.plans.slice().sort(byPlan)
  const incomes = data.incomes.slice().sort(byWhen)
  const [info, setInfo] = useState<'plans' | 'safety' | 'income' | null>(null)
  const toggleInfo = (k: 'plans' | 'safety' | 'income') =>
    setInfo((cur) => (cur === k ? null : k))

  const plansTotal = plans.reduce((s, p) => s + convert(rates, p.amt, p.cur, activeCur), 0)
  const incomeTotal = incomes.reduce((s, i) => s + convert(rates, i.amt, i.cur, activeCur), 0)
  const safetyTotal = convert(rates, data.safety.amt, data.safety.cur, activeCur)
  const safetyDirty = (Number(app.fSafety) || 0) !== data.safety.amt

  return (
    <div className="page page-plans">
      {/* ---------------- plans ---------------- */}
      <SectionHead
        label="Plans"
        total={plansTotal > 0 ? app.fmtIn(plansTotal, activeCur) : ''}
        note="Money set aside before it is spent. All of a P1, half of a P2, a fifth of a P3."
        open={info === 'plans'}
        onInfo={() => toggleInfo('plans')}
      />
      {plans.length > 0 && (
        <div className="list-card">
          {plans.map((p) => (
            <div className="plan-item" key={p.id}>
              <div className="plan-row" onClick={() => app.openPlanForm(p)}>
                <span
                  className="prio-badge"
                  style={{ color: PRIO_COLOR[p.prio], borderColor: PRIO_COLOR[p.prio] }}
                >
                  P{p.prio}
                </span>
                <span className="plan-main">
                  <span className="plan-name">{p.name}</span>
                  {p.date && <span className="plan-date">{shortDate(p.date)}</span>}
                </span>
                <span className="plan-amt">{app.fmtIn(p.amt, p.cur)}</span>
                <button
                  type="button"
                  className="x-btn"
                  aria-label={'Remove ' + p.name}
                  onClick={(e) => {
                    e.stopPropagation()
                    app.askDeletePlan(p)
                  }}
                >
                  <CrossIcon />
                </button>
              </div>
              {pf && pf.id === p.id && <PlanFormBox app={app} inCard />}
            </div>
          ))}
        </div>
      )}
      {pf && pf.id === null ? (
        <PlanFormBox app={app} />
      ) : (
        <button type="button" className="extra-link mt-14" onClick={() => app.openPlanForm()}>
          ＋ Add a plan
        </button>
      )}

      {/* ---------------- safety net ---------------- */}
      <SectionHead
        label="Safety net"
        total={safetyTotal > 0 ? app.fmtIn(safetyTotal, activeCur) : ''}
        note="What remains if every plan happened and the musts were paid. 70% is held back."
        open={info === 'safety'}
        onInfo={() => toggleInfo('safety')}
      />
      <div
        className="money-row"
        style={{ marginBottom: 0, borderColor: border(app, 'safety') }}
      >
        <span className="money-code">{data.safety.cur}</span>
        <input
          className="money-input"
          type="text"
          inputMode="decimal"
          aria-label="Safety net"
          placeholder="0"
          value={app.fSafety ? groupTyped(app.fSafety) : ''}
          onChange={(e) => app.editSafety(e.target.value)}
        />
      </div>
      <CurPick curs={selCurs} value={data.safety.cur} onPick={app.setSafetyCur} />
      <FormError message={app.errField === 'safety' ? app.formError : ''} />
      {(safetyDirty || data.safety.amt > 0) && (
        <div className="safety-actions">
          {safetyDirty && (
            <button
              type="button"
              className="btn-set"
              style={{ background: ACCENT }}
              onClick={app.saveSafety}
            >
              Set safety net
            </button>
          )}
          {data.safety.amt > 0 && (
            <button type="button" className="btn-reset" onClick={app.resetSafety}>
              Reset
            </button>
          )}
        </div>
      )}

      {/* ---------------- expected income ---------------- */}
      <SectionHead
        label="Expected income"
        total={incomeTotal > 0 ? app.fmtIn(incomeTotal, activeCur) : ''}
        note="Money on its way. The switch counts it into spendable before it arrives."
        open={info === 'income'}
        onInfo={() => toggleInfo('income')}
      />
      {incomes.length > 0 && (
        <div className="list-card">
          {incomes.map((i) => (
            <div className="plan-item" key={i.id}>
              <div className="plan-row" onClick={() => app.openIncomeForm(i)}>
                <span className="plan-main">
                  <span className="plan-name">{i.name}</span>
                  {i.date && <span className="plan-date">{shortDate(i.date)}</span>}
                </span>
                <span className="plan-amt">{app.fmtIn(i.amt, i.cur)}</span>
                <button
                  type="button"
                  className="toggle toggle-sm"
                  role="switch"
                  aria-checked={i.counted}
                  aria-label={'Count ' + i.name + ' into spendable'}
                  onClick={(e) => {
                    e.stopPropagation()
                    app.toggleCounted(i.id)
                  }}
                  style={{
                    background: i.counted ? ACCENT : 'rgba(20,22,31,.14)',
                    justifyContent: i.counted ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span />
                </button>
                <button
                  type="button"
                  className="x-btn"
                  aria-label={'Remove ' + i.name}
                  onClick={(e) => {
                    e.stopPropagation()
                    app.askDeleteIncome(i)
                  }}
                >
                  <CrossIcon />
                </button>
              </div>
              {inf && inf.id === i.id && <IncomeFormBox app={app} inCard />}
            </div>
          ))}
        </div>
      )}
      {inf && inf.id === null ? (
        <IncomeFormBox app={app} />
      ) : (
        <button type="button" className="extra-link mt-14" onClick={() => app.openIncomeForm()}>
          ＋ Add income
        </button>
      )}

      {/* ---------------- how spendable is born ---------------- */}
      <div className="sum-card">
        <div className="sum-row">
          <span>Balance</span>
          <span>{app.fmtIn(app.balance, activeCur)}</span>
        </div>
        <div className="sum-row">
          <span>Plans</span>
          <span>{MINUS + ' ' + app.fmtIn(app.plansOff, activeCur)}</span>
        </div>
        <div className="sum-row">
          <span>Safety net · 70%</span>
          <span>{MINUS + ' ' + app.fmtIn(app.safetyOff, activeCur)}</span>
        </div>
        {app.incomeIn > 0 && (
          <div className="sum-row">
            <span>Income counted</span>
            <span>{'+ ' + app.fmtIn(app.incomeIn, activeCur)}</span>
          </div>
        )}
        <div className="sum-total">
          <span>Spendable</span>
          <span>{app.fmtIn(app.spend, activeCur)}</span>
        </div>
      </div>
    </div>
  )
}
