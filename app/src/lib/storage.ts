import type {
  Account,
  Checkup,
  Expense,
  Income,
  Method,
  Phase,
  Plan,
  Prio,
  Safety,
  Settings,
  UserData,
} from '../types'
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

/** The three ways of paying, in the order the recorder shows them. */
export const METHODS: Method[] = ['cash', 'bank', 'momo']
export const METHOD_NAME: Record<Method, string> = { cash: 'Cash', bank: 'Bank', momo: 'MoMo' }

/**
 * The accounts everyone starts with, for the balance: cash in hand and one
 * bank. Naming more — Ziraat, Albaraka, a drawer at home — is a tap on the
 * Balance screen.
 */
export const STANDARD: Account[] = [
  { id: 'cash', name: 'Cash', kind: 'cash' },
  { id: 'bank', name: 'Bank', kind: 'bank' },
]

/** The one account that holds the totals when the balance is entered per currency. */
export const ALL_ID = 'all'

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
    accounts: STANDARD.map((a) => ({ ...a })),
    phases: [],
    // "a zero balance in every currency", exactly as the design starts.
    balances: { cash: { RWF: 0, TL: 0, USD: 0 }, bank: {} },
    balancesAt: 0,
    checkups: [],
    plans: [],
    incomes: [],
    safety: { amt: 0, cur: 'RWF' },
    settings: {
      round: false,
      hideBal: false,
      hideMonth: false,
      hideSpent: false,
      seenTour: false,
      hiddenMethods: [],
      balanceBy: 'account',
      remind: true,
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
      ...(typeof i.receivedAt === 'number' ? { receivedAt: i.receivedAt } : {}),
    }))
    .filter((i) => i.amt > 0)
}

const KINDS: Method[] = ['cash', 'momo', 'bank']
const isMethod = (v: unknown): v is Method => KINDS.includes(v as Method)

/** Accounts as saved by any version: only the name and the icon matter now. */
function asAccounts(v: unknown): Account[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((a): a is Account => !!a && typeof a === 'object')
    .map((a) => ({
      id: typeof a.id === 'string' && a.id ? a.id : newId(),
      name: typeof a.name === 'string' && a.name.trim() ? a.name.trim() : 'Account',
      kind: isMethod(a.kind) ? a.kind : 'cash',
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
      ...(p.offBooks ? { offBooks: true } : {}),
    }))
    .filter((p) => p.name && p.from)
}

function asCheckups(v: unknown): Checkup[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((c): c is Checkup => !!c && typeof c === 'object' && typeof c.at === 'number')
    .map((c) => ({
      id: typeof c.id === 'string' && c.id ? c.id : newId(),
      at: c.at,
      diff: c.diff && typeof c.diff === 'object' ? { ...c.diff } : {},
      total: c.total && typeof c.total === 'object' ? { ...c.total } : {},
    }))
}

/**
 * An expense as any version saved it. The first versions stamped how it
 * was paid; the version with accounts stamped which account it came out
 * of; both are read back as the way of paying.
 */
type LegacyExpense = Partial<Expense> & { acc?: string }

function asItems(v: unknown, accounts: Account[]): Expense[] {
  if (!Array.isArray(v)) return []
  return (v as LegacyExpense[])
    .filter((i) => !!i && typeof i === 'object')
    .map((i) => {
      let method: Method = 'cash'
      if (isMethod(i.method)) method = i.method
      else if (isMethod(i.acc)) method = i.acc
      else if (i.acc) method = accounts.find((a) => a.id === i.acc)?.kind ?? 'cash'
      return {
        id: typeof i.id === 'string' ? i.id : newId(),
        amount: typeof i.amount === 'number' ? i.amount : 0,
        method,
        note: typeof i.note === 'string' ? i.note : '',
        ...(typeof i.detail === 'string' && i.detail ? { detail: i.detail } : {}),
        cur: typeof i.cur === 'string' ? i.cur : 'RWF',
        at: typeof i.at === 'number' ? i.at : Date.now(),
      }
    })
}

/** Fill in anything a stored blob is missing, so an old save never crashes. */
export function normalise(
  raw: (Partial<UserData> & LegacyLimits) | null,
  now: number = Date.now(),
): UserData {
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

  // Settings from any version. A save from when hiding was one switch
  // starts with all three eyes closed if it was on; the old evening
  // reminder switch becomes the reminders switch; anything about Pro is
  // simply not read.
  const rawSettings = (raw.settings ?? {}) as Partial<Settings> & {
    hide?: boolean
    reminder?: boolean
    pro?: boolean
  }
  const settings: Settings = {
    ...base.settings,
    round: !!rawSettings.round,
    hideBal: !!rawSettings.hideBal,
    hideMonth: !!rawSettings.hideMonth,
    hideSpent: !!rawSettings.hideSpent,
    seenTour: !!rawSettings.seenTour,
    hiddenMethods: Array.isArray(rawSettings.hiddenMethods)
      ? rawSettings.hiddenMethods.filter(isMethod)
      : [],
    balanceBy: rawSettings.balanceBy === 'currency' ? 'currency' : 'account',
    remind:
      typeof rawSettings.remind === 'boolean'
        ? rawSettings.remind
        : typeof rawSettings.reminder === 'boolean'
          ? rawSettings.reminder
          : true,
  }
  if (rawSettings.hide) {
    settings.hideBal = true
    settings.hideMonth = true
    settings.hideSpent = true
  }

  // Accounts, and the balances that sit in them.
  //
  // A save from before accounts held one balance per currency and no notion
  // of where that money was. It all lands on Cash, which the Balance screen
  // then shows so it can be split across the real accounts.
  let accounts = asAccounts(raw.accounts)
  if (!accounts.length) accounts = STANDARD.map((a) => ({ ...a }))

  const items = asItems(raw.items, accounts)

  // The tour is shown once, after the first sign-in. A save from before
  // that was recorded has been through it already if anything is in it.
  if (rawSettings.seenTour === undefined) {
    const used =
      items.length > 0 ||
      plans.length > 0 ||
      Object.values((raw.balances ?? {}) as Record<string, unknown>).some((v) =>
        typeof v === 'number'
          ? v !== 0
          : Object.values((v ?? {}) as Record<string, number>).some((n) => n !== 0),
      )
    settings.seenTour = used
  }

  let balances: Record<string, Record<string, number>> = {}
  const rawBal = (raw.balances ?? {}) as Record<string, unknown>
  const perAccount = Object.values(rawBal).every((v) => v !== null && typeof v === 'object')
  if (perAccount) {
    for (const [acc, byCur] of Object.entries(rawBal)) {
      balances[acc] = { ...(byCur as Record<string, number>) }
    }
  } else {
    // The old shape: currency -> amount, with nowhere named.
    balances = { cash: { ...(rawBal as Record<string, number>) } }
  }
  // Money under an account that no longer exists is still money.
  for (const id of Object.keys(balances)) {
    if (id === ALL_ID || accounts.some((a) => a.id === id)) continue
    accounts.push({ id, name: 'Account', kind: 'cash' })
  }

  // Before check-ups, every expense was taken off the balance the moment it
  // was recorded, so a save from then is already net of them: the balances
  // stand as of now, and only what is recorded from here on counts against
  // them. A save that has never held a balance starts at zero, from the
  // beginning of time.
  const balancesAt =
    typeof raw.balancesAt === 'number' ? raw.balancesAt : raw.balances ? now : 0

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
    balancesAt,
    checkups: asCheckups(raw.checkups),
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
