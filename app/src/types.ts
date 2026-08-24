export type Method = 'cash' | 'momo' | 'bank'

export interface Expense {
  id: string
  amount: number
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
  balances: Record<string, number>
  plans: Plan[]
  incomes: Income[]
  safety: Safety
  settings: Settings
  items: Expense[]
  /** True after "Delete all expenses", so the wiped empty state differs from the fresh one. */
  cleared: boolean
}

/**
 * The signed-in person. Firebase owns the account itself — the id is their
 * Firebase uid and the password never reaches this app — so nothing secret
 * is kept here.
 */
export interface Account {
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
