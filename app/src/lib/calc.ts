import type { Expense, Income, Phase, Plan, Prio, Safety } from '../types'
import { convert } from './rates'

export const DAY = 864e5

/**
 * The heart of the app.
 *
 *   spendable = balance
 *             − all of P1 − half of P2 − a fifth of P3
 *             − 70% of the safety net
 *             + expected income that is counted in
 *
 * A P1 plan is certain, so all of it is set aside. P2 is likely (half)
 * and P3 is loose (a fifth). The safety net is what should remain if
 * every plan happened; a person dips into a cushion in real life, so
 * only 70% of it is held back. Expected income is someone else's money
 * until it arrives — it counts only when its switch is on.
 */
export const PRIO_TAKE: Record<Prio, number> = { 1: 1, 2: 0.5, 3: 0.2 }
export const SAFETY_TAKE = 0.7

/** What one plan sets aside, in the display currency. */
export function planTake(
  rates: Record<string, number>,
  plan: Plan,
  display: string,
): number {
  return convert(rates, plan.amt * PRIO_TAKE[plan.prio], plan.cur, display)
}

/** What all plans set aside together. */
export function plansTake(
  rates: Record<string, number>,
  plans: Plan[],
  display: string,
): number {
  return plans.reduce((s, p) => s + planTake(rates, p, display), 0)
}

/** The held-back share of the safety net. */
export function safetyTake(
  rates: Record<string, number>,
  safety: Safety,
  display: string,
): number {
  return convert(rates, safety.amt * SAFETY_TAKE, safety.cur, display)
}

/** Expected income whose switch is on. */
export function countedIncome(
  rates: Record<string, number>,
  incomes: Income[],
  display: string,
): number {
  return incomes
    .filter((i) => i.counted)
    .reduce((s, i) => s + convert(rates, i.amt, i.cur, display), 0)
}

export function spendableNow(
  rates: Record<string, number>,
  balance: number,
  plans: Plan[],
  safety: Safety,
  incomes: Income[],
  display: string,
): number {
  return (
    balance -
    plansTake(rates, plans, display) -
    safetyTake(rates, safety, display) +
    countedIncome(rates, incomes, display)
  )
}

/**
 * How far the balance falls short of the P1 plans alone — the red warning
 * when above zero. Counted income does not rescue it: P1 money is owed in
 * full, and income that has not arrived cannot pay it.
 */
export function p1Shortfall(
  rates: Record<string, number>,
  balance: number,
  plans: Plan[],
  display: string,
): number {
  const p1 = plansTake(
    rates,
    plans.filter((p) => p.prio === 1),
    display,
  )
  return Math.max(0, p1 - balance)
}

/** P1s are covered but the spendable has run out — the violet warning. */
export function intoSafety(
  rates: Record<string, number>,
  balance: number,
  plans: Plan[],
  safety: Safety,
  incomes: Income[],
  display: string,
): boolean {
  return (
    p1Shortfall(rates, balance, plans, display) === 0 &&
    spendableNow(rates, balance, plans, safety, incomes, display) < 0
  )
}

/* ------------------------------------------------------------------
   The ultimate total.

   Money held in several currencies is one pot, not three. Every total
   is converted at the current rates and added up, then shown in
   whichever currency is being viewed. The currency tabs pick the
   currency the single total is expressed in — they do not slice it.
------------------------------------------------------------------ */

/** What one account holds, every currency added up, expressed in `display`. */
export function accountBalance(
  rates: Record<string, number>,
  balances: Balances,
  acc: string,
  codes: string[],
  display: string,
): number {
  const held = balances[acc] ?? {}
  return codes.reduce(
    (sum, code) => sum + convert(rates, held[code] ?? 0, code, display),
    0,
  )
}

/**
 * Everything, everywhere: every account's every currency, added up and
 * expressed in `display`. Money in two places is still one pot.
 */
export function totalBalance(
  rates: Record<string, number>,
  balances: Balances,
  codes: string[],
  display: string,
): number {
  return Object.keys(balances).reduce(
    (sum, acc) => sum + accountBalance(rates, balances, acc, codes, display),
    0,
  )
}

/* ------------------------------------------------------------------
   Spending draws the balance down.

   An expense lowers the account it came out of, in the currency it was
   recorded in, and undoing it puts that money back in the same place.
   "Update balance" is the correction: it replaces the totals with what
   the person says they really have.
------------------------------------------------------------------ */

/** Account id -> currency -> amount. */
export type Balances = Record<string, Record<string, number>>

function move(balances: Balances, acc: string, code: string, by: number): Balances {
  const held = balances[acc] ?? {}
  return { ...balances, [acc]: { ...held, [code]: (held[code] ?? 0) + by } }
}

export function applyRecord(balances: Balances, item: Expense): Balances {
  return move(balances, item.acc, item.cur, -item.amount)
}

export function applyDelete(balances: Balances, item: Expense): Balances {
  return move(balances, item.acc, item.cur, item.amount)
}

/** Only the difference moves, so editing twice does not double-count. */
export function applyEdit(
  balances: Balances,
  item: Expense,
  nextAmount: number,
  nextAcc: string = item.acc,
): Balances {
  // Moved to another account: the whole amount goes back where it came
  // from and comes out of the new one.
  if (nextAcc !== item.acc) {
    return move(
      move(balances, item.acc, item.cur, item.amount),
      nextAcc,
      item.cur,
      -nextAmount,
    )
  }
  return move(balances, item.acc, item.cur, item.amount - nextAmount)
}

export function applyDeleteAll(balances: Balances, items: Expense[]): Balances {
  let out = { ...balances }
  for (const i of items) out = move(out, i.acc, i.cur, i.amount)
  return out
}

/* ------------------------------------------------------------------
   Aggregates. Every expense carries the currency it was recorded in,
   so a total is always converted into the currency being displayed.
------------------------------------------------------------------ */

export function amountIn(
  rates: Record<string, number>,
  item: Expense,
  display: string,
): number {
  return convert(rates, item.amount, item.cur, display)
}

export function sumIn(
  rates: Record<string, number>,
  items: Expense[],
  display: string,
): number {
  return items.reduce((s, i) => s + amountIn(rates, i, display), 0)
}

/** What was spent out of one account. */
export function sumFrom(
  rates: Record<string, number>,
  items: Expense[],
  acc: string,
  display: string,
): number {
  return sumIn(
    rates,
    items.filter((i) => i.acc === acc),
    display,
  )
}

/* ------------------------------------------------------------------
   Phases: a named stretch of time.

   A phase is drawn around days already lived, so nothing is stamped on
   an expense — an expense belongs to a phase if its day falls inside
   it. Move the dates and the expenses follow, which is what lets a
   phase be named after the fact.
------------------------------------------------------------------ */

/** A moment as yyyy-mm-dd in the phone's own timezone. */
export function dayKey(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** An empty `to` means the phase is still running. */
export function inPhase(phase: Phase, at: number): boolean {
  const day = dayKey(at)
  if (day < phase.from) return false
  return !phase.to || day <= phase.to
}

export function phaseItems(items: Expense[], phase: Phase): Expense[] {
  return items.filter((i) => inPhase(phase, i.at))
}

/** The phase a moment falls in. Newest start wins if two overlap. */
export function phaseAt(phases: Phase[], at: number): Phase | null {
  return (
    phases
      .filter((p) => inPhase(p, at))
      .sort((a, b) => b.from.localeCompare(a.from))[0] ?? null
  )
}

/** How many days the phase covers, counting both ends, up to today. */
export function phaseDays(phase: Phase, now: number = Date.now()): number {
  const from = new Date(phase.from + 'T12:00:00').getTime()
  const end = phase.to ? new Date(phase.to + 'T12:00:00').getTime() : now
  return Math.max(1, Math.round((end - from) / DAY) + 1)
}

/** Newest first, with a phase still running always at the top. */
export function sortPhases(phases: Phase[]): Phase[] {
  return phases.slice().sort((a, b) => {
    if (!a.to !== !b.to) return a.to ? 1 : -1
    return b.from.localeCompare(a.from)
  })
}

/** Whole days between the expense and today, in the phone's own timezone. */
export function dayOffset(at: number, now: number = Date.now()): number {
  const a = new Date(at)
  const b = new Date(now)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / DAY)
}

const MON = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function dayLabel(at: number, now: number = Date.now()): string {
  const off = dayOffset(at, now)
  if (off === 0) return 'Today'
  if (off === 1) return 'Yesterday'
  const d = new Date(at)
  return d.getDate() + ' ' + MON[d.getMonth()]
}

/**
 * "13 Aug" from a timestamp — the day marks along a strip's axis. A day
 * from another year says so: "5 Jan 27".
 */
export function dayStamp(at: number, now: number = Date.now()): string {
  const d = new Date(at)
  const label = d.getDate() + ' ' + MON[d.getMonth()]
  return d.getFullYear() === new Date(now).getFullYear()
    ? label
    : label + ' ' + String(d.getFullYear()).slice(2)
}

/** "12 Sep", with the year added only when it is not this year. */
export function shortDate(iso: string, now: number = Date.now()): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  const label = d + ' ' + MON[m - 1]
  return y === new Date(now).getFullYear() ? label : label + ' ' + y
}

export function monthIndex(at: number): number {
  const d = new Date(at)
  return d.getFullYear() * 12 + d.getMonth()
}

export function monthName(index: number): string {
  return MON[((index % 12) + 12) % 12]
}

/** Group expenses by day, newest first. */
export function byDay(
  items: Expense[],
  now: number = Date.now(),
): { off: number; label: string; items: Expense[] }[] {
  const map = new Map<number, Expense[]>()
  for (const i of items) {
    const off = dayOffset(i.at, now)
    const list = map.get(off)
    if (list) list.push(i)
    else map.set(off, [i])
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([off, list]) => ({
      off,
      label: dayLabel(list[0].at, now),
      items: list.sort((a, b) => b.at - a.at),
    }))
}

/** The top five categories by amount, largest first. */
export function topCategories(
  rates: Record<string, number>,
  items: Expense[],
  display: string,
  labelOf: (i: Expense) => string,
): { name: string; value: number }[] {
  const map: Record<string, number> = {}
  for (const i of items) {
    const k = labelOf(i)
    map[k] = (map[k] || 0) + amountIn(rates, i, display)
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }))
}
