import { describe, expect, it } from 'vitest'
import { freshData, normalise } from './storage'

describe('reading an old save', () => {
  it('turns each Must into a P1 plan and pools the nets into one safety pot', () => {
    const d = normalise({
      selCurs: ['RWF', 'USD'],
      mainCur: 'RWF',
      limits: {
        RWF: { must: 460_000, net: 140_000 },
        USD: { must: 100, net: 200 },
      },
    })
    expect(d.plans).toHaveLength(2)
    expect(d.plans.every((p) => p.prio === 1 && p.name === 'Musts')).toBe(true)
    expect(d.plans.map((p) => [p.cur, p.amt])).toEqual([
      ['RWF', 460_000],
      ['USD', 100],
    ])
    // 140,000 + 200 × 1420 = 424,000, all in the main currency
    expect(d.safety).toEqual({ amt: 424_000, cur: 'RWF' })
  })

  it('skips a currency whose Must was zero', () => {
    const d = normalise({
      selCurs: ['RWF'],
      mainCur: 'RWF',
      limits: { RWF: { must: 0, net: 5000 } },
    })
    expect(d.plans).toEqual([])
    expect(d.safety.amt).toBe(5000)
  })

  it('keeps a new save exactly as it is', () => {
    const d = freshData()
    d.plans = [{ id: 'x', name: 'Rent', amt: 60_000, cur: 'RWF', prio: 2, date: '2026-09-12' }]
    d.incomes = [
      { id: 'y', name: 'Salary', amt: 300_000, cur: 'RWF', date: '', counted: true },
    ]
    d.safety = { amt: 50_000, cur: 'USD' }
    const round = normalise(JSON.parse(JSON.stringify(d)))
    expect(round.plans).toEqual(d.plans)
    expect(round.incomes).toEqual(d.incomes)
    expect(round.safety).toEqual(d.safety)
  })

  it('starts a truly empty save fresh', () => {
    const d = normalise(null)
    expect(d.plans).toEqual([])
    expect(d.incomes).toEqual([])
    expect(d.safety).toEqual({ amt: 0, cur: 'RWF' })
    expect(d.balancesAt).toBe(0)
    expect(d.checkups).toEqual([])
  })

  it('spreads the old single hide switch across the three eyes', () => {
    const d = normalise({ settings: { round: false, hide: true } } as never)
    expect(d.settings.hideBal).toBe(true)
    expect(d.settings.hideMonth).toBe(true)
    expect(d.settings.hideSpent).toBe(true)

    const off = normalise({ settings: { round: false, hide: false } } as never)
    expect(off.settings.hideBal).toBe(false)
  })

  it('drops a stored plan that lost its amount', () => {
    const d = normalise({
      plans: [
        { id: 'a', name: 'Ok', amt: 10, cur: 'RWF', prio: 1, date: '' },
        { id: 'b', name: 'Broken', amt: 0, cur: 'RWF', prio: 1, date: '' },
      ],
      safety: { amt: 0, cur: 'RWF' },
    })
    expect(d.plans.map((p) => p.id)).toEqual(['a'])
  })
})

describe('how an expense was paid', () => {
  it('reads the first versions, which stamped the way of paying', () => {
    const d = normalise({
      items: [{ id: 'a', amount: 2400, method: 'momo', note: '', cur: 'RWF', at: 1 }],
    } as never)
    expect(d.items[0].method).toBe('momo')
  })

  it('reads the version with accounts: a standard account is its own way of paying', () => {
    const d = normalise({
      items: [
        { id: 'a', amount: 2400, acc: 'momo', note: '', cur: 'RWF', at: 1 },
        { id: 'b', amount: 850, acc: 'bank', note: '', cur: 'RWF', at: 2 },
      ],
    } as never)
    expect(d.items.map((i) => i.method)).toEqual(['momo', 'bank'])
  })

  it('and a named account is paid the way its icon says', () => {
    const d = normalise({
      accounts: [{ id: 'z1', name: 'Ziraat', kind: 'bank' }],
      items: [{ id: 'a', amount: 2400, acc: 'z1', note: '', cur: 'RWF', at: 1 }],
    } as never)
    expect(d.items[0].method).toBe('bank')
  })

  it('remembers which ways of paying are kept off the recorder', () => {
    const d = normalise({ settings: { hiddenMethods: ['momo', 'nonsense'] } } as never)
    expect(d.settings.hiddenMethods).toEqual(['momo'])
  })
})

describe('accounts are where the balance is', () => {
  it('moves a balance with nowhere named onto Cash', () => {
    const d = normalise({
      selCurs: ['RWF', 'USD'],
      mainCur: 'RWF',
      balances: { RWF: 840_000, USD: 1_240 } as never,
    })
    expect(d.balances.cash).toEqual({ RWF: 840_000, USD: 1_240 })
    expect(d.accounts.map((a) => a.id)).toContain('cash')
  })

  it('keeps a balance that already knows where it sits', () => {
    const d = normalise({
      balances: { cash: { RWF: 500 }, ziraat: { TL: 12_000 } },
      accounts: [
        { id: 'cash', name: 'Cash', kind: 'cash' },
        { id: 'ziraat', name: 'Ziraat', kind: 'bank' },
      ],
    })
    expect(d.balances.ziraat).toEqual({ TL: 12_000 })
    expect(d.accounts).toHaveLength(2)
  })

  it('keeps money whose account is gone, under a stand-in', () => {
    const d = normalise({ balances: { gone: { RWF: 900 } } })
    expect(d.accounts.some((a) => a.id === 'gone')).toBe(true)
    expect(d.balances.gone.RWF).toBe(900)
  })

  it('gives a new person Cash and Bank', () => {
    expect(normalise(null).accounts.map((a) => a.id)).toEqual(['cash', 'bank'])
  })

  it('reads a save from before check-ups as standing now, so old expenses do not come off twice', () => {
    const d = normalise({ balances: { cash: { RWF: 500 } } }, 1_700_000_000_000)
    expect(d.balancesAt).toBe(1_700_000_000_000)
    const kept = normalise({ balances: { cash: { RWF: 500 } }, balancesAt: 42 }, 1_700_000_000_000)
    expect(kept.balancesAt).toBe(42)
  })

  it('keeps the check-ups and how the balance is entered', () => {
    const d = normalise({
      checkups: [{ id: 'c', at: 5, diff: { RWF: -10 }, total: { RWF: 490 } }],
      settings: { balanceBy: 'currency' },
    } as never)
    expect(d.checkups).toEqual([{ id: 'c', at: 5, diff: { RWF: -10 }, total: { RWF: 490 } }])
    expect(d.settings.balanceBy).toBe('currency')
  })
})

describe('phases, incomes and the tour', () => {
  it('drops a phase with no name or no start, and keeps one left out of totals', () => {
    const d = normalise({
      phases: [
        { id: 'a', name: 'Rwanda', from: '2026-06-01', to: '2026-09-02', offBooks: true },
        { id: 'b', name: '', from: '2026-01-01', to: '' },
        { id: 'c', name: 'Nowhere', from: '', to: '' },
      ] as never,
    })
    expect(d.phases.map((p) => p.name)).toEqual(['Rwanda'])
    expect(d.phases[0].offBooks).toBe(true)
  })

  it('keeps an income marked received', () => {
    const d = normalise({
      incomes: [{ id: 'i', name: 'Pay', amt: 10, cur: 'RWF', date: '', counted: true, receivedAt: 7 }],
    })
    expect(d.incomes[0].receivedAt).toBe(7)
  })

  it('shows the tour to a brand new person, and never again once they have seen it', () => {
    expect(normalise(null).settings.seenTour).toBe(false)
    expect(normalise({ settings: { seenTour: true } } as never).settings.seenTour).toBe(true)
  })

  it('counts a save from before the flag as toured if anything was ever recorded in it', () => {
    const used = normalise({
      items: [{ id: 'a', amount: 1, method: 'cash', note: '', cur: 'RWF', at: 1 }],
    } as never)
    expect(used.settings.seenTour).toBe(true)
    const heldOnly = normalise({ balances: { RWF: 500 } } as never)
    expect(heldOnly.settings.seenTour).toBe(true)
    const empty = normalise({ settings: { round: false } } as never)
    expect(empty.settings.seenTour).toBe(false)
  })

  it('reads the old evening-reminder switch as the reminders switch', () => {
    expect(normalise({ settings: { reminder: false } } as never).settings.remind).toBe(false)
    expect(normalise(null).settings.remind).toBe(true)
  })
})
