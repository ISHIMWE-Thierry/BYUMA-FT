import { describe, expect, it } from 'vitest'
import {
  checkupDiff,
  countedIncome,
  p1Shortfall,
  runningBalance,
  spendableNow,
  totalBalance,
  type BalanceSource,
} from './calc'
import { BASE_RATES } from './rates'
import type { Expense, Income, Plan } from '../types'

const T0 = Date.UTC(2026, 8, 1, 12) // the last check-up
const later = (hours: number) => T0 + hours * 36e5

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: Math.random().toString(36),
  amount: 2400,
  method: 'momo',
  note: 'Groceries',
  cur: 'RWF',
  at: later(1),
  ...over,
})

const income = (over: Partial<Income> = {}): Income => ({
  id: Math.random().toString(36),
  name: 'Salary',
  amt: 300_000,
  cur: 'RWF',
  date: '',
  counted: false,
  ...over,
})

/** A check-up of one account in one currency, with nothing recorded since. */
const src = (amount: number, over: Partial<BalanceSource> = {}): BalanceSource => ({
  balances: { cash: { RWF: amount } },
  balancesAt: T0,
  items: [],
  incomes: [],
  phases: [],
  ...over,
})

describe('the balance is the last check-up, less what was recorded since', () => {
  it('starts at what the check-up said', () => {
    expect(runningBalance(src(840_000), 'RWF')).toBe(840_000)
  })

  it('an expense recorded after the check-up comes off', () => {
    const s = src(840_000, { items: [expense()] })
    expect(runningBalance(s, 'RWF')).toBe(837_600)
  })

  it('an expense recorded before the check-up is already in it, so it does not come off twice', () => {
    const s = src(840_000, { items: [expense({ at: later(-3) })] })
    expect(runningBalance(s, 'RWF')).toBe(840_000)
  })

  it('counts every account together', () => {
    const s = src(0, { balances: { cash: { RWF: 340_000 }, ziraat: { RWF: 500_000 } } })
    expect(runningBalance(s, 'RWF')).toBe(840_000)
  })

  it('keeps currencies apart', () => {
    const s = src(0, {
      balances: { cash: { RWF: 840_000, USD: 1240 } },
      items: [expense({ cur: 'USD', amount: 40 })],
    })
    expect(runningBalance(s, 'USD')).toBe(1200)
    expect(runningBalance(s, 'RWF')).toBe(840_000)
  })

  it('can go below zero rather than clamping', () => {
    const s = src(1000, { items: [expense({ amount: 2500 })] })
    expect(runningBalance(s, 'RWF')).toBe(-1500)
  })

  it('an income received since the check-up goes on', () => {
    const s = src(840_000, { incomes: [income({ receivedAt: later(2) })] })
    expect(runningBalance(s, 'RWF')).toBe(1_140_000)
  })

  it('an income received before the check-up is already in it', () => {
    const s = src(840_000, { incomes: [income({ receivedAt: later(-2) })] })
    expect(runningBalance(s, 'RWF')).toBe(840_000)
  })

  it('an expense in a phase kept off the books still left the pocket', () => {
    const s = src(840_000, {
      items: [expense({ at: Date.UTC(2026, 8, 5, 12) })],
      phases: [{ id: 'p', name: 'Trip', from: '2026-09-03', to: '2026-09-10', offBooks: true }],
    })
    expect(runningBalance(s, 'RWF')).toBe(837_600)
  })

  it('the total is every currency converted and added up', () => {
    const s = src(0, { balances: { cash: { RWF: 840_000, USD: 100 } } })
    // 100 USD at the base rate of 1420
    expect(totalBalance(BASE_RATES, s, ['RWF', 'USD'], 'RWF')).toBe(982_000)
  })
})

describe('a check-up measures what moved unrecorded', () => {
  it('finds nothing when the records were complete', () => {
    const s = src(840_000, { items: [expense({ amount: 40_000 })] })
    const { diff, total } = checkupDiff(s, { cash: { RWF: 800_000 } }, ['RWF'])
    expect(total.RWF).toBe(800_000)
    expect(diff.RWF).toBe(0)
  })

  it('reads a shortfall as spending that was never recorded', () => {
    const s = src(840_000, { items: [expense({ amount: 40_000 })] })
    const { diff } = checkupDiff(s, { cash: { RWF: 790_000 } }, ['RWF'])
    expect(diff.RWF).toBe(-10_000)
  })

  it('reads a surplus as money that came in unrecorded', () => {
    const s = src(840_000)
    const { diff } = checkupDiff(s, { cash: { RWF: 900_000 } }, ['RWF'])
    expect(diff.RWF).toBe(60_000)
  })

  it('takes money in any account, however the total is entered', () => {
    const s = src(840_000)
    const { diff } = checkupDiff(s, { ziraat: { RWF: 500_000 }, all: { RWF: 340_000 } }, ['RWF'])
    expect(diff.RWF).toBe(0)
  })

  it('answers per currency', () => {
    const s = src(0, { balances: { cash: { RWF: 840_000, USD: 1240 } } })
    const { diff } = checkupDiff(s, { cash: { RWF: 840_000, USD: 1200 } }, ['RWF', 'USD'])
    expect(diff).toEqual({ RWF: 0, USD: -40 })
  })
})

describe('the whole picture', () => {
  const plans: Plan[] = [
    { id: 'p', name: 'Musts', amt: 460_000, cur: 'RWF', prio: 1, date: '' },
  ]
  const safety = { amt: 140_000, cur: 'RWF' }

  it('spending eats into the spendable amount', () => {
    let s = src(840_000)
    // 840,000 − 460,000 − 98,000
    let total = totalBalance(BASE_RATES, s, ['RWF'], 'RWF')
    expect(spendableNow(BASE_RATES, total, plans, safety, [], 'RWF')).toBe(282_000)

    s = src(840_000, { items: [expense({ amount: 75_000 })] })
    total = totalBalance(BASE_RATES, s, ['RWF'], 'RWF')
    expect(spendableNow(BASE_RATES, total, plans, safety, [], 'RWF')).toBe(207_000)
  })

  it('spending enough turns the balance red against the P1 plans', () => {
    const s = src(500_000, { items: [expense({ amount: 60_000 })] })
    const total = totalBalance(BASE_RATES, s, ['RWF'], 'RWF')
    expect(total).toBe(440_000)
    expect(p1Shortfall(BASE_RATES, total, plans, 'RWF')).toBe(20_000)
  })

  it('an income counts into spendable until it is received, and into the balance after', () => {
    const inc = income({ counted: true })
    expect(countedIncome(BASE_RATES, [inc], 'RWF')).toBe(300_000)
    const got = { ...inc, receivedAt: later(1) }
    expect(countedIncome(BASE_RATES, [got], 'RWF')).toBe(0)
    expect(runningBalance(src(100_000, { incomes: [got] }), 'RWF')).toBe(400_000)
  })
})
