import { describe, expect, it } from 'vitest'
import {
  applyDelete,
  applyDeleteAll,
  applyEdit,
  applyRecord,
  p1Shortfall,
  spendableNow,
  totalBalance,
} from './calc'
import { BASE_RATES } from './rates'
import type { Expense, Plan } from '../types'

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: Math.random().toString(36),
  amount: 2400,
  acc: 'momo',
  note: 'Groceries',
  cur: 'RWF',
  at: Date.now(),
  ...over,
})

/** One account holding one currency, which is most of these cases. */
const held = (acc: string, cur: string, amount: number) => ({ [acc]: { [cur]: amount } })

describe('spending draws the balance down', () => {
  it('lowers the account it came out of, in the currency it was recorded in', () => {
    const after = applyRecord(held('momo', 'RWF', 840_000), expense())
    expect(after.momo.RWF).toBe(837_600)
  })

  it('leaves the other accounts alone', () => {
    const before = { momo: { RWF: 840_000 }, bank: { RWF: 500_000 } }
    const after = applyRecord(before, expense())
    expect(after.momo.RWF).toBe(837_600)
    expect(after.bank.RWF).toBe(500_000)
  })

  it('leaves the other currencies alone', () => {
    const before = { momo: { RWF: 840_000, USD: 1240 } }
    const after = applyRecord(before, expense({ cur: 'USD', amount: 40 }))
    expect(after.momo.USD).toBe(1200)
    expect(after.momo.RWF).toBe(840_000)
  })

  it('can take the balance negative rather than clamping at zero', () => {
    const after = applyRecord(held('momo', 'RWF', 1000), expense({ amount: 2500 }))
    expect(after.momo.RWF).toBe(-1500)
  })

  it('starts an account or currency it has never seen at zero', () => {
    const after = applyRecord({}, expense({ acc: 'ziraat', cur: 'KES', amount: 300 }))
    expect(after.ziraat.KES).toBe(-300)
  })
})

describe('undoing a spend puts the money back', () => {
  it('deleting restores the exact amount, to the same account', () => {
    const item = expense()
    const spent = applyRecord(held('momo', 'RWF', 840_000), item)
    expect(applyDelete(spent, item).momo.RWF).toBe(840_000)
  })

  it('deleting them all restores every account and currency', () => {
    const items = [
      expense({ amount: 2400, cur: 'RWF', acc: 'momo' }),
      expense({ amount: 850, cur: 'RWF', acc: 'cash' }),
      expense({ amount: 40, cur: 'USD', acc: 'momo' }),
    ]
    const start = { momo: { RWF: 840_000, USD: 1240 }, cash: { RWF: 20_000 } }
    let bal = start as Record<string, Record<string, number>>
    for (const i of items) bal = applyRecord(bal, i)
    expect(bal.momo).toEqual({ RWF: 837_600, USD: 1200 })
    expect(bal.cash).toEqual({ RWF: 19_150 })

    expect(applyDeleteAll(bal, items)).toEqual(start)
  })
})

describe('editing moves only the difference', () => {
  it('raising the amount takes the extra off', () => {
    const item = expense({ amount: 2400 })
    const spent = applyRecord(held('momo', 'RWF', 840_000), item)
    expect(applyEdit(spent, item, 3000).momo.RWF).toBe(837_000)
  })

  it('lowering the amount gives the difference back', () => {
    const item = expense({ amount: 2400 })
    const spent = applyRecord(held('momo', 'RWF', 840_000), item)
    expect(applyEdit(spent, item, 400).momo.RWF).toBe(839_600)
  })

  it('saving the same amount changes nothing', () => {
    const item = expense({ amount: 2400 })
    const spent = applyRecord(held('momo', 'RWF', 840_000), item)
    expect(applyEdit(spent, item, 2400).momo.RWF).toBe(spent.momo.RWF)
  })

  it('moving it to another account moves the money whole', () => {
    const item = expense({ amount: 2400, acc: 'momo' })
    const spent = applyRecord({ momo: { RWF: 840_000 }, bank: { RWF: 100_000 } }, item)
    const moved = applyEdit(spent, item, 2400, 'bank')
    expect(moved.momo.RWF).toBe(840_000)
    expect(moved.bank.RWF).toBe(97_600)
  })

  it('moving it and changing the amount does both at once', () => {
    const item = expense({ amount: 2400, acc: 'momo' })
    const spent = applyRecord({ momo: { RWF: 840_000 }, bank: { RWF: 100_000 } }, item)
    const moved = applyEdit(spent, item, 1000, 'bank')
    expect(moved.momo.RWF).toBe(840_000)
    expect(moved.bank.RWF).toBe(99_000)
  })
})

describe('the whole picture', () => {
  const plans: Plan[] = [
    { id: 'p', name: 'Musts', amt: 460_000, cur: 'RWF', prio: 1, date: '' },
  ]
  const safety = { amt: 140_000, cur: 'RWF' }

  it('spending eats into the spendable amount', () => {
    let bal = held('momo', 'RWF', 840_000)
    const codes = ['RWF']
    // 840,000 − 460,000 − 98,000
    let total = totalBalance(BASE_RATES, bal, codes, 'RWF')
    expect(spendableNow(BASE_RATES, total, plans, safety, [], 'RWF')).toBe(282_000)

    bal = applyRecord(bal, expense({ amount: 75_000 }))
    total = totalBalance(BASE_RATES, bal, codes, 'RWF')
    expect(spendableNow(BASE_RATES, total, plans, safety, [], 'RWF')).toBe(207_000)
  })

  it('counts money spread over accounts as one pot', () => {
    const bal = { cash: { RWF: 340_000 }, bank: { RWF: 500_000 } }
    expect(totalBalance(BASE_RATES, bal, ['RWF'], 'RWF')).toBe(840_000)
  })

  it('spending enough turns the balance red against the P1 plans', () => {
    let bal = held('momo', 'RWF', 500_000)
    bal = applyRecord(bal, expense({ amount: 60_000 }))
    const total = totalBalance(BASE_RATES, bal, ['RWF'], 'RWF')
    expect(total).toBe(440_000)
    expect(p1Shortfall(BASE_RATES, total, plans, 'RWF')).toBe(20_000)
  })
})
