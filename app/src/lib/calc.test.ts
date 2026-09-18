import { describe, expect, it } from 'vitest'
import {
  amountIn,
  byDay,
  countedIncome,
  dayLabel,
  dayOffset,
  dayStamp,
  inPhase,
  intoSafety,
  phaseAt,
  phaseDays,
  phaseItems,
  p1Shortfall,
  plansTake,
  safetyTake,
  shortDate,
  spendableNow,
  sortPhases,
  sumIn,
  topCategories,
  totalBalance,
} from './calc'
import { BASE_RATES, convert, estRate, withRate } from './rates'
import type { Expense, Income, Plan } from '../types'

const DAY = 864e5

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: Math.random().toString(36),
  amount: 1000,
  acc: 'cash',
  note: '',
  cur: 'RWF',
  at: Date.now(),
  ...over,
})

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: Math.random().toString(36),
  name: 'Rent',
  amt: 1000,
  cur: 'RWF',
  prio: 1,
  date: '',
  ...over,
})

const income = (over: Partial<Income> = {}): Income => ({
  id: Math.random().toString(36),
  name: 'Salary',
  amt: 1000,
  cur: 'RWF',
  date: '',
  counted: false,
  ...over,
})

const NO_SAFETY = { amt: 0, cur: 'RWF' }

describe('spendable', () => {
  it('sets aside all of a P1, half of a P2, a fifth of a P3', () => {
    const plans = [
      plan({ amt: 100_000, prio: 1 }),
      plan({ amt: 60_000, prio: 2 }),
      plan({ amt: 50_000, prio: 3 }),
    ]
    // 100,000 + 30,000 + 10,000
    expect(plansTake(BASE_RATES, plans, 'RWF')).toBe(140_000)
    expect(spendableNow(BASE_RATES, 840_000, plans, NO_SAFETY, [], 'RWF')).toBe(700_000)
  })

  it('holds back 70% of the safety net', () => {
    const safety = { amt: 140_000, cur: 'RWF' }
    expect(safetyTake(BASE_RATES, safety, 'RWF')).toBe(98_000)
    expect(spendableNow(BASE_RATES, 840_000, [], safety, [], 'RWF')).toBe(742_000)
  })

  it('adds expected income only when its switch is on', () => {
    const incomes = [
      income({ amt: 50_000, counted: true }),
      income({ amt: 999_999, counted: false }),
    ]
    expect(countedIncome(BASE_RATES, incomes, 'RWF')).toBe(50_000)
    expect(spendableNow(BASE_RATES, 100_000, [], NO_SAFETY, incomes, 'RWF')).toBe(150_000)
  })

  it('converts plans, safety and income across currencies', () => {
    // 1 USD = 1420 RWF
    expect(plansTake(BASE_RATES, [plan({ amt: 100, cur: 'USD' })], 'RWF')).toBe(142_000)
    expect(safetyTake(BASE_RATES, { amt: 10, cur: 'USD' }, 'RWF')).toBe(9940)
    expect(
      countedIncome(BASE_RATES, [income({ amt: 1, cur: 'USD', counted: true })], 'RWF'),
    ).toBe(1420)
  })

  it('is just the balance when nothing is set', () => {
    expect(spendableNow(BASE_RATES, 5000, [], NO_SAFETY, [], 'RWF')).toBe(5000)
  })
})

describe('the two warnings', () => {
  it('goes red when the balance cannot cover the P1 plans in full', () => {
    const plans = [plan({ amt: 500, prio: 1 })]
    expect(p1Shortfall(BASE_RATES, 400, plans, 'RWF')).toBe(100)
    expect(intoSafety(BASE_RATES, 400, plans, NO_SAFETY, [], 'RWF')).toBe(false)
  })

  it('leaves P2 and P3 out of the red warning', () => {
    const plans = [plan({ amt: 900, prio: 2 }), plan({ amt: 900, prio: 3 })]
    expect(p1Shortfall(BASE_RATES, 400, plans, 'RWF')).toBe(0)
  })

  it('income that has not arrived cannot pay a P1', () => {
    const plans = [plan({ amt: 500, prio: 1 })]
    const incomes = [income({ amt: 10_000, counted: true })]
    // spendable rises with the counted income, but the red warning stands
    expect(spendableNow(BASE_RATES, 400, plans, NO_SAFETY, incomes, 'RWF')).toBe(9900)
    expect(p1Shortfall(BASE_RATES, 400, plans, 'RWF')).toBe(100)
  })

  it('goes violet when only the cushion is eaten into', () => {
    const plans = [plan({ amt: 300, prio: 1 })]
    const safety = { amt: 200, cur: 'RWF' }
    // 400 − 300 − 140 = −40: the P1 is covered, the cushion is not
    expect(p1Shortfall(BASE_RATES, 400, plans, 'RWF')).toBe(0)
    expect(intoSafety(BASE_RATES, 400, plans, safety, [], 'RWF')).toBe(true)
  })

  it('shows neither when there is money left', () => {
    const plans = [plan({ amt: 100, prio: 1 })]
    const safety = { amt: 100, cur: 'RWF' }
    expect(p1Shortfall(BASE_RATES, 1000, plans, 'RWF')).toBe(0)
    expect(intoSafety(BASE_RATES, 1000, plans, safety, [], 'RWF')).toBe(false)
  })

  it('never shows both at once', () => {
    const plans = [plan({ amt: 300, prio: 1 })]
    const safety = { amt: 200, cur: 'RWF' }
    for (const bal of [0, 100, 340, 400, 1000]) {
      const red = p1Shortfall(BASE_RATES, bal, plans, 'RWF') > 0
      const violet = intoSafety(BASE_RATES, bal, plans, safety, [], 'RWF')
      expect(red && violet).toBe(false)
    }
  })
})

describe('short dates', () => {
  it('shows day and month, with the year only when it is another year', () => {
    const y = new Date().getFullYear()
    expect(shortDate(y + '-09-12')).toBe('12 Sep')
    expect(shortDate('2030-01-05')).toBe('5 Jan 2030')
    expect(shortDate('')).toBe('')
  })

  it('stamps a timestamp as day and month for the strip axis', () => {
    const now = new Date(2026, 7, 15).getTime()
    expect(dayStamp(new Date(2026, 7, 13, 12, 0).getTime(), now)).toBe('13 Aug')
    expect(dayStamp(new Date(2027, 0, 5).getTime(), now)).toBe('5 Jan 27')
  })
})

describe('the rate table', () => {
  it('shows a pair as from over main, to two decimals', () => {
    expect(estRate(BASE_RATES, 'USD', 'RWF')).toBe(1420)
    expect(estRate(BASE_RATES, 'RWF', 'USD')).toBe(0)
    expect(estRate(BASE_RATES, 'TL', 'USD')).toBe(0.02)
  })

  it('writes an edited rate back through the main currency', () => {
    const next = withRate(BASE_RATES, 'USD', 1500, 'RWF')
    expect(next.USD).toBe(1500)
    expect(estRate(next, 'USD', 'RWF')).toBe(1500)
  })

  it('an edit made against one main currency holds for every pair', () => {
    // With USD as main, saying 1 EUR = 1.1 USD must survive a switch to RWF.
    const next = withRate(BASE_RATES, 'EUR', 1.1, 'USD')
    expect(next.EUR).toBeCloseTo(1562, 0)
    expect(estRate(next, 'EUR', 'USD')).toBe(1.1)
  })

  it('ignores a zero or blank edit rather than rejecting it', () => {
    expect(withRate(BASE_RATES, 'USD', 0, 'RWF')).toBe(BASE_RATES)
  })

  it('converts between currencies', () => {
    expect(convert(BASE_RATES, 100, 'USD', 'RWF')).toBe(142_000)
    expect(convert(BASE_RATES, 142_000, 'RWF', 'USD')).toBe(100)
    expect(convert(BASE_RATES, 50, 'RWF', 'RWF')).toBe(50)
  })
})

describe('totals', () => {
  it('converts every expense into the currency being shown', () => {
    const items = [
      expense({ amount: 1000, cur: 'RWF' }),
      expense({ amount: 1, cur: 'USD' }),
    ]
    expect(sumIn(BASE_RATES, items, 'RWF')).toBe(2420)
  })

  it('reads a single expense in another currency', () => {
    expect(amountIn(BASE_RATES, expense({ amount: 2, cur: 'USD' }), 'RWF')).toBe(2840)
  })
})

describe('day grouping', () => {
  it('labels today and yesterday by name', () => {
    expect(dayLabel(Date.now())).toBe('Today')
    expect(dayLabel(Date.now() - DAY)).toBe('Yesterday')
  })

  it('labels anything older by date', () => {
    expect(dayLabel(Date.now() - 5 * DAY)).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/)
  })

  it('counts whole days, not 24-hour blocks', () => {
    const now = new Date(2026, 7, 13, 1, 0, 0).getTime()
    const lateYesterday = new Date(2026, 7, 12, 23, 30, 0).getTime()
    expect(dayOffset(lateYesterday, now)).toBe(1)
  })

  it('groups newest day first and newest row first inside a day', () => {
    const now = Date.now()
    const groups = byDay(
      [
        expense({ at: now - 2 * DAY, amount: 1 }),
        expense({ at: now - 60_000, amount: 2 }),
        expense({ at: now - 30_000, amount: 3 }),
      ],
      now,
    )
    expect(groups[0].label).toBe('Today')
    expect(groups[0].items.map((i) => i.amount)).toEqual([3, 2])
    expect(groups[1].off).toBe(2)
  })
})

describe('top categories', () => {
  it('returns at most five, largest first', () => {
    const items = [
      expense({ amount: 100, note: 'Food' }),
      expense({ amount: 500, note: 'Rent' }),
      expense({ amount: 50, note: 'Food' }),
      expense({ amount: 10, note: 'Bus' }),
      expense({ amount: 9, note: 'A' }),
      expense({ amount: 8, note: 'B' }),
      expense({ amount: 7, note: 'C' }),
    ]
    const top = topCategories(BASE_RATES, items, 'RWF', (i) => i.note)
    expect(top).toHaveLength(5)
    expect(top[0]).toEqual({ name: 'Rent', value: 500 })
    expect(top[1]).toEqual({ name: 'Food', value: 150 })
  })

  it('falls back to the method name when there is no note', () => {
    const top = topCategories(
      BASE_RATES,
      [expense({ amount: 20, note: '', acc: 'momo' })],
      'RWF',
      (i) => i.note || i.acc,
    )
    expect(top[0].name).toBe('momo')
  })
})

describe('the ultimate total', () => {
  // 1 USD = 1420 RWF, 1 TL = 34 RWF. Spread over two accounts, because a
  // pot is a pot however many places it sits in.
  const balances = {
    cash: { RWF: 840_000, TL: 9_600 },
    bank: { USD: 1_240 },
  }
  const codes = ['RWF', 'TL', 'USD']

  it('adds every currency into one figure', () => {
    // 840,000 + 9,600x34 + 1,240x1420 = 840,000 + 326,400 + 1,760,800
    expect(totalBalance(BASE_RATES, balances, codes, 'RWF')).toBe(2_927_200)
  })

  it('gives the same money whichever currency it is shown in', () => {
    const inRwf = totalBalance(BASE_RATES, balances, codes, 'RWF')
    const inUsd = totalBalance(BASE_RATES, balances, codes, 'USD')
    expect(inUsd).toBeCloseTo(inRwf / 1420, 6)
  })

  it('counts only the currencies that are picked', () => {
    expect(totalBalance(BASE_RATES, balances, ['RWF'], 'RWF')).toBe(840_000)
    expect(totalBalance(BASE_RATES, balances, ['RWF', 'TL'], 'RWF')).toBe(1_166_400)
  })

  it('treats a currency with no balance as zero', () => {
    expect(totalBalance(BASE_RATES, { cash: { RWF: 500 } }, ['RWF', 'USD'], 'RWF')).toBe(500)
  })

  it('drives spendable off the whole pot, not one currency', () => {
    const plans = [plan({ amt: 460_000, cur: 'RWF', prio: 1 })]
    const safety = { amt: 140_000, cur: 'RWF' }
    const bal = totalBalance(BASE_RATES, balances, codes, 'RWF')
    // 2,927,200 − 460,000 − 98,000
    expect(spendableNow(BASE_RATES, bal, plans, safety, [], 'RWF')).toBe(2_369_200)
  })

  it('follows an edited rate', () => {
    const cheaper = withRate(BASE_RATES, 'USD', 1000, 'RWF')
    expect(totalBalance(cheaper, { bank: { USD: 2 } }, ['USD'], 'RWF')).toBe(2000)
  })
})

describe('phases', () => {
  const rwanda = { id: 'r', name: 'Rwanda', from: '2026-06-01', to: '2026-09-02' }
  const turkiye = { id: 't', name: 'Türkiye', from: '2026-09-03', to: '' }
  const on = (iso: string) => new Date(iso + 'T12:00:00').getTime()

  it('takes in both ends of the stretch', () => {
    expect(inPhase(rwanda, on('2026-06-01'))).toBe(true)
    expect(inPhase(rwanda, on('2026-09-02'))).toBe(true)
    expect(inPhase(rwanda, on('2026-05-31'))).toBe(false)
    expect(inPhase(rwanda, on('2026-09-03'))).toBe(false)
  })

  it('a phase with no end runs to whenever you ask', () => {
    expect(inPhase(turkiye, on('2026-09-03'))).toBe(true)
    expect(inPhase(turkiye, on('2027-01-01'))).toBe(true)
    expect(inPhase(turkiye, on('2026-09-02'))).toBe(false)
  })

  it('gathers only the expenses whose day falls inside', () => {
    const items = [
      expense({ amount: 100, at: on('2026-07-04') }),
      expense({ amount: 200, at: on('2026-09-10') }),
      expense({ amount: 400, at: on('2026-08-30') }),
    ]
    expect(sumIn(BASE_RATES, phaseItems(items, rwanda), 'RWF')).toBe(500)
    expect(sumIn(BASE_RATES, phaseItems(items, turkiye), 'RWF')).toBe(200)
  })

  it('names the phase a day belongs to, newest start winning an overlap', () => {
    expect(phaseAt([rwanda, turkiye], on('2026-07-04'))?.name).toBe('Rwanda')
    expect(phaseAt([rwanda, turkiye], on('2026-10-01'))?.name).toBe('Türkiye')
    expect(phaseAt([rwanda, turkiye], on('2026-01-01'))).toBe(null)
  })

  it('counts the days it covers, both ends included', () => {
    expect(phaseDays({ ...rwanda, from: '2026-06-01', to: '2026-06-01' })).toBe(1)
    expect(phaseDays({ ...rwanda, from: '2026-06-01', to: '2026-06-10' })).toBe(10)
  })

  it('puts a running phase first, then the newest', () => {
    const order = sortPhases([rwanda, turkiye]).map((p) => p.name)
    expect(order).toEqual(['Türkiye', 'Rwanda'])
  })
})
