import type { Account, Expense, Income, Method, Phase, Plan, Prio, Safety, Settings, UserData } from '../types'
import { BASE_CURS, BASE_RATES, convert } from './rates'

/** An account as the phone-only versions wrote it, password hash and all. */
export interface LegacyAccount {
  id: string
  name: string
  email: string
  createdAt: number
  passkeyId?: string
}

/**
 * What still belongs to the phone rather than to the account.
 *
 * The money data lives in Firebase now (see cloud.ts), and Firestore keeps
 * its own saved copy for working offline. Two things stay here:
 *
 *   - the passkey this phone enrolled, which is bound to this phone and
 *     would be meaningless on another one;
 *   - whatever an older, phone-only version of the app saved, kept only so
 *     it can be carried up the first time its owner signs in.
 */

// Written by the versions before Firebase. Read for that migration, never
// written again.
const K_ACCOUNTS = 'byuma.accounts.v1'
const K_DATA = 'byuma.data.v1.'
const K_SESSION = 'byuma.session.v1'
const K_LAST = 'byuma.last.v1'

const K_PASSKEY = 'byuma.passkey.v1.'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked (private mode). The app keeps running on the
    // state it already has in memory rather than crashing.
  }
}

export const BASE_CATS = ['Transport', 'Food', 'Groceries', 'Coffee', 'Bills', 'Rent']

/** The Categories screen's own limit, applied wherever one is created. */
export const MAX_CAT = 18

/**
 * A note typed straight into the recorder becomes a category, so the next
 * time it is one tap away. The chips are ordered by how often each has been
 * used, so a new one that catches on rises to the front by itself.
 *
 * Same rules as adding one by hand: not empty, under 18 characters, and no
 * duplicate regardless of case. Anything else is left as a one-off note.
 */
export function rememberCategory(cats: string[], note: string): string[] {
  const name = note.trim()
  if (!name || name.length > MAX_CAT) return cats
  if (cats.some((c) => c.toLowerCase() === name.toLowerCase())) return cats
  return [...cats, name]
}

/**
 * The accounts everyone starts with. Cash and Bank are the two a person
 * always has; MoMo is the same kind of thing but not everybody uses one, so
 * it is offered rather than assumed. None of the three can be renamed —
 * naming your own is what Pro is for.
 */
export const STANDARD: Account[] = [
  { id: 'cash', name: 'Cash', kind: 'cash' },
  { id: 'bank', name: 'Bank', kind: 'bank' },
  { id: 'momo', name: 'MoMo', kind: 'momo' },
]

/** The two that are there from the start; MoMo is added if it is wanted. */
const STARTING = ['cash', 'bank']

export const isStandard = (id: string) => STANDARD.some((a) => a.id === id)

/** A brand new account: no expenses, and a zero balance everywhere. */
export function freshData(): UserData {
  return {
    cats: BASE_CATS.slice(),
    allCurs: BASE_CURS.slice(),
    selCurs: ['RWF', 'TL', 'USD'],
    mainCur: 'RWF',
    rates: { ...BASE_RATES },
    manualRates: [],
    ratesFetchedAt: null,
    accounts: STANDARD.filter((a) => STARTING.includes(a.id)).map((a) => ({ ...a })),
    phases: [],
    // "a zero balance in every currency", exactly as the design starts.
    balances: { cash: { RWF: 0, TL: 0, USD: 0 }, bank: {} },
    plans: [],
    incomes: [],
    safety: { amt: 0, cur: 'RWF' },
    settings: {
      round: false,
      reminder: true,
      hideBal: false,
      hideMonth: false,
      hideSpent: false,
      pro: false,
    },
    items: [],
    cleared: false,
  }
}

/** The shape saves had before Limits became Plans. */
interface LegacyLimits {
  limits?: Record<string, { must?: number; net?: number }>
}

const PRIOS: Prio[] = [1, 2, 3]

function asPlans(v: unknown): Plan[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((p): p is Plan => !!p && typeof p === 'object')
    .map((p) => ({
      id: typeof p.id === 'string' ? p.id : newId(),
      name: typeof p.name === 'string' ? p.name : '',
      amt: typeof p.amt === 'number' && p.amt > 0 ? p.amt : 0,
      cur: typeof p.cur === 'string' ? p.cur : 'RWF',
      prio: PRIOS.includes(p.prio) ? p.prio : 1,
      date: typeof p.date === 'string' ? p.date : '',
    }))
    .filter((p) => p.amt > 0)
}

function asIncomes(v: unknown): Income[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((i): i is Income => !!i && typeof i === 'object')
    .map((i) => ({
      id: typeof i.id === 'string' ? i.id : newId(),
      name: typeof i.name === 'string' ? i.name : '',
      amt: typeof i.amt === 'number' && i.amt > 0 ? i.amt : 0,
      cur: typeof i.cur === 'string' ? i.cur : 'RWF',
      date: typeof i.date === 'string' ? i.date : '',
      counted: !!i.counted,
    }))
    .filter((i) => i.amt > 0)
}

const KINDS: Method[] = ['cash', 'momo', 'bank']

function asAccounts(v: unknown): Account[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((a): a is Account => !!a && typeof a === 'object')
    .map((a) => ({
      id: typeof a.id === 'string' && a.id ? a.id : newId(),
      name: typeof a.name === 'string' && a.name.trim() ? a.name.trim() : 'Account',
      kind: KINDS.includes(a.kind) ? a.kind : 'cash',
      ...(a.custom ? { custom: true } : {}),
    }))
}

function asPhases(v: unknown): Phase[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((p): p is Phase => !!p && typeof p === 'object')
    .map((p) => ({
      id: typeof p.id === 'string' && p.id ? p.id : newId(),
      name: typeof p.name === 'string' ? p.name : '',
      from: typeof p.from === 'string' ? p.from : '',
      to: typeof p.to === 'string' ? p.to : '',
    }))
    .filter((p) => p.name && p.from)
}

/** The shape expenses and balances had before accounts existed. */
type LegacyExpense = Partial<Expense> & { method?: Method }

function asItems(v: unknown): Expense[] {
  if (!Array.isArray(v)) return []
  return (v as LegacyExpense[])
    .filter((i) => !!i && typeof i === 'object')
    .map((i) => ({
      id: typeof i.id === 'string' ? i.id : newId(),
      amount: typeof i.amount === 'number' ? i.amount : 0,
      // Before accounts, an expense carried the shape it was paid in, and
      // those three shapes are exactly the three standard accounts — so the
      // old value already names the account it came from.
      acc: typeof i.acc === 'string' && i.acc ? i.acc : (i.method ?? 'cash'),
      note: typeof i.note === 'string' ? i.note : '',
      ...(typeof i.detail === 'string' && i.detail ? { detail: i.detail } : {}),
      cur: typeof i.cur === 'string' ? i.cur : 'RWF',
      at: typeof i.at === 'number' ? i.at : Date.now(),
    }))
}

/** Fill in anything a stored blob is missing, so an old save never crashes. */
export function normalise(raw: (Partial<UserData> & LegacyLimits) | null): UserData {
  const base = freshData()
  if (!raw) return base
  const selCurs =
    Array.isArray(raw.selCurs) && raw.selCurs.length ? raw.selCurs : base.selCurs
  const mainCur =
    typeof raw.mainCur === 'string' && selCurs.includes(raw.mainCur)
      ? raw.mainCur
      : selCurs[0]
  const rates = { ...base.rates, ...(raw.rates ?? {}) }

  // A save from the Limits days: each currency's Must was taken in full,
  // which is exactly what a P1 plan means, so each becomes one. The safety
  // nets were one cushion spread over currencies — they are added up into
  // a single pot in the main currency, at the save's own rates.
  let plans = asPlans(raw.plans)
  let safety: Safety =
    raw.safety && typeof raw.safety.amt === 'number'
      ? { amt: raw.safety.amt, cur: raw.safety.cur || mainCur }
      : { amt: 0, cur: mainCur }
  if (!raw.plans && !raw.safety && raw.limits) {
    for (const [cur, lim] of Object.entries(raw.limits)) {
      if (lim?.must && lim.must > 0) {
        plans.push({ id: newId(), name: 'Musts', amt: lim.must, cur, prio: 1, date: '' })
      }
    }
    const net = Object.entries(raw.limits).reduce(
      (s, [cur, lim]) => s + convert(rates, lim?.net ?? 0, cur, mainCur),
      0,
    )
    safety = { amt: net, cur: mainCur }
  }

  // A save from when hiding was one switch: if it was on, all three of
  // today's independent eyes start closed.
  const rawSettings = (raw.settings ?? {}) as Partial<Settings> & { hide?: boolean }
  const settings: Settings = { ...base.settings, ...rawSettings }
  if (rawSettings.hide) {
    settings.hideBal = true
    settings.hideMonth = true
    settings.hideSpent = true
  }

  const items = asItems(raw.items)

  // Accounts, and the balances that sit in them.
  //
  // A save from before accounts held one balance per currency and no notion
  // of where that money was. It all lands on Cash, which the Update balance
  // screen then says plainly so it can be split across the real accounts.
  let accounts = asAccounts(raw.accounts)
  let balances: Record<string, Record<string, number>> = {}
  const rawBal = (raw.balances ?? {}) as Record<string, unknown>
  const perAccount = Object.values(rawBal).every(
    (v) => v !== null && typeof v === 'object',
  )

  if (perAccount) {
    for (const [acc, byCur] of Object.entries(rawBal)) {
      balances[acc] = { ...(byCur as Record<string, number>) }
    }
  } else {
    // The old shape: currency -> amount, with nowhere named.
    balances = { cash: { ...(rawBal as Record<string, number>) } }
  }

  if (!accounts.length) {
    accounts = STANDARD.filter((a) => STARTING.includes(a.id)).map((a) => ({ ...a }))
  }
  // Nothing may be orphaned: an expense recorded on MoMo keeps MoMo on the
  // list even though a new person is not given one.
  for (const i of items) {
    if (accounts.some((a) => a.id === i.acc)) continue
    const standard = STANDARD.find((a) => a.id === i.acc)
    accounts.push(standard ? { ...standard } : { id: i.acc, name: 'Account', kind: 'cash' })
  }

  return {
    cats: Array.isArray(raw.cats) ? raw.cats : base.cats,
    allCurs: Array.isArray(raw.allCurs) && raw.allCurs.length ? raw.allCurs : base.allCurs,
    selCurs,
    mainCur,
    rates,
    manualRates: Array.isArray(raw.manualRates) ? raw.manualRates : [],
    ratesFetchedAt: typeof raw.ratesFetchedAt === 'number' ? raw.ratesFetchedAt : null,
    accounts,
    phases: asPhases(raw.phases),
    balances,
    plans,
    incomes: asIncomes(raw.incomes),
    safety,
    settings,
    items,
    cleared: !!raw.cleared,
  }
}

/* ---------------- what an older version of the app left behind ---------- */

/** Accounts saved by the phone-only versions. Read for the migration only. */
export function loadAccounts(): LegacyAccount[] {
  return read<LegacyAccount[]>(K_ACCOUNTS, [])
}

export function loadData(accountId: string): UserData {
  return normalise(read<Partial<UserData> | null>(K_DATA + accountId, null))
}

/**
 * Drop what the phone-only version saved for an email address. Called once
 * that data has been carried up to the account it belongs to, and again if
 * the account is deleted, so a stale copy is never left lying on the phone.
 */
export function clearLegacyFor(email: string): void {
  const target = email.trim().toLowerCase()
  const list = loadAccounts()
  const gone = list.filter((a) => a.email.toLowerCase() === target)
  if (!gone.length) return
  const kept = list.filter((a) => a.email.toLowerCase() !== target)
  try {
    for (const a of gone) localStorage.removeItem(K_DATA + a.id)
    if (kept.length) write(K_ACCOUNTS, kept)
    else {
      localStorage.removeItem(K_ACCOUNTS)
      localStorage.removeItem(K_SESSION)
      localStorage.removeItem(K_LAST)
    }
  } catch {
    /* ignore */
  }
}

/* ---------------- the passkey this phone enrolled ---------------------- */

export function loadPasskeyId(uid: string): string | undefined {
  return read<string | null>(K_PASSKEY + uid, null) ?? undefined
}

export function savePasskeyId(uid: string, credentialId: string): void {
  write(K_PASSKEY + uid, credentialId)
}

export function clearPasskeyId(uid: string): void {
  try {
    localStorage.removeItem(K_PASSKEY + uid)
  } catch {
    /* ignore */
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
