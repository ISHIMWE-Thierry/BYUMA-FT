import type {
  Account,
  Expense,
  Income,
  Method,
  Phase,
  Plan,
  Prio,
  Safety,
  UserData,
} from '../types'
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
 * until it arrives — it counts only when its switch is on, and once it
 * has been received it is in the balance itself.
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

/** Expected income whose switch is on and which has not arrived yet. */
export function countedIncome(
  rates: Record<string, number>,
  incomes: Income[],
  display: string,
): number {
  return incomes
    .filter((i) => i.counted && !i.receivedAt)
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
   The balance.

   The last check-up is the truth: what each account held, per
   currency, at that moment. From there the records take over — every
   expense recorded since comes off, every income received since goes
   on — so the balance shown is what the records say there should be
   now. The next check-up replaces it with what there really is, and
   the gap between the two is the money that moved unrecorded.

   Money held in several currencies is one pot, not three. Every total
   is converted at the current rates and added up, then shown in
   whichever currency is being viewed.
------------------------------------------------------------------ */

/** Account id -> currency -> amount, as entered at the last check-up. */
export type Balances = Record<string, Record<string, number>>

/** What one account held at the last check-up, every currency added up. */
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

/** What one account holds in its own currency, as of the last check-up. */
export function heldIn(balances: Balances, acc: Account): number {
  return balances[acc.id]?.[acc.cur] ?? 0
}

/** What every account together held at the last check-up, in one currency. */
export function snapshotTotal(balances: Balances, code: string): number {
  return Object.values(balances).reduce((s, held) => s + (held?.[code] ?? 0), 0)
}

/** The part of the data the running balance is made from. */
export type BalanceSource = Pick<
  UserData,
  'balances' | 'balancesAt' | 'items' | 'incomes' | 'phases'
>

/**
 * What the records say one currency stands at now: the check-up total,
 * less every expense recorded since it, plus every income received since.
 * Expenses in a phase kept off the books still left the pocket, so they
 * still count here.
 */
export function runningBalance(src: BalanceSource, code: string): number {
  const since = src.balancesAt
  const spent = src.items
    .filter((i) => i.cur === code && i.at > since)
    .reduce((s, i) => s + i.amount, 0)
  const received = src.incomes
    .filter((i) => i.cur === code && !!i.receivedAt && i.receivedAt > since)
    .reduce((s, i) => s + i.amt, 0)
  return snapshotTotal(src.balances, code) - spent + received
}

/**
 * Everything, everywhere, as the records have it now, expressed in
 * `display`. Every currency an account holds is counted, even one no
 * longer among the chosen ones, so money is never silently left out.
 */
export function totalBalance(
  rates: Record<string, number>,
  src: BalanceSource,
  codes: string[],
  display: string,
): number {
  const all = new Set(codes)
  for (const held of Object.values(src.balances)) {
    for (const code of Object.keys(held ?? {})) all.add(code)
  }
  return [...all].reduce(
    (sum, code) => sum + convert(rates, runningBalance(src, code), code, display),
    0,
  )
}

/**
 * A check-up: the totals just entered against what the records expected,
 * per currency. Plus means more than expected — money came in unrecorded;
 * minus means spending that was never recorded.
 */
export function checkupDiff(
  src: BalanceSource,
  entered: Balances,
  codes: string[],
): { diff: Record<string, number>; total: Record<string, number> } {
  const diff: Record<string, number> = {}
  const total: Record<string, number> = {}
  for (const code of codes) {
    total[code] = snapshotTotal(entered, code)
    diff[code] = total[code] - runningBalance(src, code)
  }
  return { diff, total }
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

/** What was spent one way — cash, bank or MoMo. */
export function sumFrom(
  rates: Record<string, number>,
  items: Expense[],
  method: Method,
  display: string,
): number {
  return sumIn(
    rates,
    items.filter((i) => i.method === method),
    display,
  )
}

/* ------------------------------------------------------------------
   Phases: a named stretch of time.

   Nothing is stamped on an expense — it belongs to a phase if its day
   falls inside it. Start a phase and what is recorded from then on is
   in it; end it and the months take over again.
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

/** The phase still running, if there is one. */
export function runningPhase(phases: Phase[]): Phase | null {
  return sortPhases(phases).find((p) => !p.to) ?? null
}

/**
 * The expenses that count towards the totals: everything except what
 * fell in a phase kept off the books. The graphs are drawn from all of
 * them regardless.
 */
export function countedItems(items: Expense[], phases: Phase[]): Expense[] {
  const off = phases.filter((p) => p.offBooks)
  if (!off.length) return items
  return items.filter((i) => !off.some((p) => inPhase(p, i.at)))
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

/* ------------------------------------------------------------------
   Periods: how History is cut up.

   An expense in a phase belongs to that phase; every other expense
   belongs to its month. Newest first, so a running phase heads the
   list and last month sits under this one.
------------------------------------------------------------------ */

export interface Period {
  /** The phase's id, or "m:<month index>". */
  key: string
  label: string
  phase: Phase | null
  items: Expense[]
}

export function periods(items: Expense[], phases: Phase[]): Period[] {
  const order: string[] = []
  const map = new Map<string, Period>()
  for (const i of items.slice().sort((a, b) => b.at - a.at)) {
    const ph = phaseAt(phases, i.at)
    const key = ph ? ph.id : 'm:' + monthIndex(i.at)
    let p = map.get(key)
    if (!p) {
      p = {
        key,
        label: ph ? ph.name : monthLabel(monthIndex(i.at)),
        phase: ph,
        items: [],
      }
      map.set(key, p)
      order.push(key)
    }
    p.items.push(i)
  }
  return order.map((k) => map.get(k)!)
}

/* ------------------------------------------------------------------
   Reminders: what is due soon.
------------------------------------------------------------------ */

export interface Due {
  /** Stable across days for the same thing, so a note is not shown twice. */
  key: string
  kind: 'plan' | 'income'
  name: string
  amt: number
  cur: string
  date: string
  /** 0 today, 1 tomorrow, 2 the day after. */
  daysLeft: number
}

/**
 * Plans and incomes falling due today or within the next two days. An
 * income already received is done with; a plan has no such state, so it
 * keeps reminding until its day has passed.
 */
export function dueSoon(
  plans: Plan[],
  incomes: Income[],
  now: number = Date.now(),
  within = 2,
): Due[] {
  const today = dayKey(now)
  const last = dayKey(now + within * DAY)
  const out: Due[] = []
  const left = (date: string) =>
    Math.round((new Date(date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / DAY)
  for (const p of plans) {
    if (p.date && p.date >= today && p.date <= last)
      out.push({ key: 'plan:' + p.id, kind: 'plan', name: p.name, amt: p.amt, cur: p.cur, date: p.date, daysLeft: left(p.date) })
  }
  for (const i of incomes) {
    if (!i.receivedAt && i.date && i.date >= today && i.date <= last)
      out.push({ key: 'income:' + i.id, kind: 'income', name: i.name, amt: i.amt, cur: i.cur, date: i.date, daysLeft: left(i.date) })
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}

/** "today", "tomorrow", "in 2 days" — or nothing once it is not close. */
export function dueWord(date: string, now: number = Date.now()): string {
  if (!date) return ''
  const today = dayKey(now)
  if (date < today) return 'past'
  const n = Math.round(
    (new Date(date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / DAY,
  )
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n <= 2) return 'in ' + n + ' days'
  return ''
}

/* ------------------------------------------------------------------
   Dates and grouping.
------------------------------------------------------------------ */

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
const MONTH = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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

/** "September 2026" from a month index. */
export function monthLabel(index: number): string {
  return MONTH[((index % 12) + 12) % 12] + ' ' + Math.floor(index / 12)
}

/** Only the expenses of the month `now` is in. */
export function monthItems(items: Expense[], now: number = Date.now()): Expense[] {
  const m = monthIndex(now)
  return items.filter((i) => monthIndex(i.at) === m)
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
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
}
