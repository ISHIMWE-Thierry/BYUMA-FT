/** The three ways of paying, which is also all an icon needs to know. */
export type Method = 'cash' | 'momo' | 'bank'

/**
 * Somewhere money sits — Cash, Ziraat, Albaraka, a drawer at home. Accounts
 * are for the balance only: the total is made from what each holds at the
 * last check-up. How an expense was paid is a Method, not an account.
 */
export interface Account {
  id: string
  name: string
  kind: Method
}

/**
 * A named stretch of time — "Rwanda", "Back in Türkiye". Start one and the
 * expenses recorded while it runs fall into it; when none is running, the
 * months do the grouping. A phase can be left out of the totals and still
 * be drawn in the graphs.
 */
export interface Phase {
  id: string
  name: string
  /** yyyy-mm-dd. `to` empty means it is still running. */
  from: string
  to: string
  /** Its expenses stay out of "spent" and the breakdowns; the graphs keep them. */
  offBooks?: boolean
}

export interface Expense {
  id: string
  amount: number
  /** How it was paid. */
  method: Method
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
  /** Set when the Received button is pressed: it is in the balance now. */
  receivedAt?: number
}

/** What should remain if every plan happened and the musts were paid. */
export interface Safety {
  amt: number
  cur: string
}

/**
 * One balance check-up: the moment the totals were entered, and how far
 * they were from what the records expected — the money that moved without
 * being recorded, per currency. Plus is more than expected.
 */
export interface Checkup {
  id: string
  at: number
  diff: Record<string, number>
  total: Record<string, number>
}

/** The three hide flags are independent: each figure keeps its own eye. */
export interface Settings {
  round: boolean
  hideBal: boolean
  hideMonth: boolean
  hideSpent: boolean
  /** The first-run tour has been shown once, after the first sign-in. */
  seenTour: boolean
  /** Ways of paying kept off the recorder. */
  hiddenMethods: Method[]
  /** How the balance is entered: per account, or one total per currency. */
  balanceBy: 'account' | 'currency'
  /** A note on the phone two days before, and on the day, a plan or income is due. */
  remind: boolean
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
  /** Per account, then per currency: what was there at the last check-up. */
  balances: Record<string, Record<string, number>>
  /** When the balances were last entered. Expenses after it draw the total down. */
  balancesAt: number
  checkups: Checkup[]
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
  | 'phases'
  | 'phase'
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
