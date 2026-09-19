/** The three shapes money takes, which is all an icon needs to know. */
export type Method = 'cash' | 'momo' | 'bank'

/**
 * Somewhere money sits: Cash, a bank, a wallet on a phone.
 *
 * Everyone has these. Without Pro they are the three standard ones and
 * cannot be renamed; with Pro a person names their own — Ziraat, Albaraka —
 * and each still borrows one of the three shapes for its icon.
 */
export interface Account {
  id: string
  name: string
  kind: Method
  /** Made by the person rather than one of the three standard ones. */
  custom?: boolean
  /** Kept off the recorder's row of accounts. History and balances still know it. */
  hidden?: boolean
}

/**
 * A named stretch of time — "Rwanda", "Back in Türkiye" — so a season of
 * spending can be read on its own. Expenses belong to a phase by their
 * date, so a phase can be drawn around a time already lived. Pro only.
 */
export interface Phase {
  id: string
  name: string
  /** yyyy-mm-dd. `to` empty means it is still running. */
  from: string
  to: string
  /** Expenses added by hand from outside the dates, by id. */
  items?: string[]
}

export interface Expense {
  id: string
  amount: number
  /** The account it came out of. Matches an Account id. */
  acc: string
  note: string
  /** A longer clarification, offered only inside the editor. */
  detail?: string
  /** The currency the expense was recorded in — the main currency at the time. */
  cur: string
  /** Real timestamp. The day grouping on the timeline is derived from this. */
  at: number
}

/** How hard a plan is committed. P1 is certain, P2 likely, P3 loose. */
export type Prio = 1 | 2 | 3

/** Money set aside for something that is going to happen. */
export interface Plan {
  id: string
  /** What it is — "Rent", "School fees". */
  name: string
  amt: number
  cur: string
  prio: Prio
  /** Estimated day it happens, as yyyy-mm-dd, or '' when unknown. */
  date: string
}

/** Money expected to arrive. Counted into spendable only when asked to. */
export interface Income {
  id: string
  name: string
  amt: number
  cur: string
  date: string
  counted: boolean
}

/** What should remain if every plan happened and the musts were paid. */
export interface Safety {
  amt: number
  cur: string
}

/** The three hide flags are independent: each figure keeps its own eye. */
export interface Settings {
  round: boolean
  reminder: boolean
  hideBal: boolean
  hideMonth: boolean
  hideSpent: boolean
  /** Named accounts and phases. Off by default; nothing is lost turning it off. */
  pro: boolean
  /** The first-run tour has been shown once, after the first sign-in. */
  seenTour: boolean
}

/** Everything one signed-in person owns. Saved on the phone under their id. */
export interface UserData {
  cats: string[]
  allCurs: string[]
  selCurs: string[]
  mainCur: string
  /** Value of one unit of each currency, expressed in RWF. */
  rates: Record<string, number>
  /** Codes whose rate the person typed themselves — a refresh must not overwrite these. */
  manualRates: string[]
  ratesFetchedAt: number | null
  /** Per account, then per currency: what is in that account right now. */
  balances: Record<string, Record<string, number>>
  accounts: Account[]
  phases: Phase[]
  plans: Plan[]
  incomes: Income[]
  safety: Safety
  settings: Settings
  items: Expense[]
  /** True after "Delete all expenses", so the wiped empty state differs from the fresh one. */
  cleared: boolean
}

/**
 * The signed-in person. Firebase owns the sign-in itself — the id is their
 * Firebase uid and the password never reaches this app — so nothing secret
 * is kept here.
 */
export interface User {
  id: string
  name: string
  email: string
  createdAt: number
  /**
   * Set once this phone has been asked to remember the account. A passkey
   * belongs to one phone, so this is stored on the phone rather than in the
   * account: another phone must enrol its own.
   */
  passkeyId?: string
}

export type Screen =
  | 'signup'
  | 'signin'
  | 'lock'
  | 'tour'
  | 'home'
  | 'history'
  | 'stats'
  | 'balance'
  | 'plans'
  | 'curs'
  | 'profile'
  | 'name'
  | 'email'
  | 'password'
  | 'cats'
  | 'accounts'
  | 'phases'
  | 'phase'
  | 'pro'
  | 'forgot'
  | 'error'

export interface ToastState {
  text: string
  kind: 'ok' | 'warn'
}

export interface ConfirmState {
  title: string
  body: string
  cta: string
  danger?: boolean
  yes: () => void
}
