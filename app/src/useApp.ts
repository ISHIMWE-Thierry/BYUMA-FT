import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Account,
  Phase,
  User,
  ConfirmState,
  Expense,
  Income,
  Method,
  Plan,
  Prio,
  Screen,
  Settings,
  ToastState,
  UserData,
} from './types'
import { clean, fmt as fmtMoney, toNumber } from './lib/money'
import { BASE_CURS, estRate, fetchRates, withRate } from './lib/rates'
import {
  applyDelete,
  applyDeleteAll,
  applyEdit,
  applyRecord,
  countedIncome,
  p1Shortfall,
  plansTake,
  safetyTake,
  totalBalance,
  inPhase,
} from './lib/calc'
import { passkeyAvailable, registerPasskey, verifyPasskey } from './lib/passkey'
import {
  clearLegacyFor,
  clearPasskeyId,
  freshData,
  STANDARD,
  loadPasskeyId,
  newId,
  rememberCategory,
  savePasskeyId,
} from './lib/storage'
import { auth, isConfigured } from './lib/firebase'
import { deleteCloud, loadCloud, localDataFor, saveCloud } from './lib/cloud'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type User as FbUser,
} from 'firebase/auth'

/** How long each consequential action holds the freeze, from the spec. */
const FREEZE = {
  signup: 1100,
  signin: 1000,
  saveName: 700,
  saveEmail: 900,
  savePassword: 1000,
  unlock: 700,
  resetPassword: 900,
  erase: 1200,
  saveBalance: 800,
  deleteOne: 600,
  deleteAll: 1200,
  signOut: 1100,
  retry: 900,
} as const

/** Today as yyyy-mm-dd in the phone's own timezone, for a date input. */
export function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Turn a picked day into a timestamp. Today keeps the current time so the
 * newest expense still sorts to the top; any other day lands at midday, far
 * enough from either midnight that a timezone will not shunt it into the
 * neighbouring day.
 */
/** A timestamp as yyyy-mm-dd, for filling a date input. */
export function dayInput(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function atOn(day: string, now: number = Date.now()): number {
  if (!day) return now
  if (day === today()) return now
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return now
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime()
}

const emailOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())

/**
 * Firebase speaks in codes; the app speaks in sentences. Anything not named
 * here falls back to a plain line rather than showing a raw code.
 */
function authMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email already has an account.'
    case 'auth/invalid-email':
      return 'That email does not look right.'
    case 'auth/weak-password':
      return 'Use at least 8 characters.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.'
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a minute and try again.'
    case 'auth/network-request-failed':
      return 'No internet. Connect and try again.'
    case 'auth/requires-recent-login':
      return 'Sign out and back in first, then try again.'
    case 'auth/unauthorized-domain':
      // The app is being served from an address Firebase has not been told
      // about — say which, because the fix is to add exactly that one under
      // Authentication → Settings → Authorized domains.
      return 'This address is not allowed by Firebase yet: ' + location.hostname
    case 'auth/operation-not-allowed':
      return 'Email sign-in is switched off in Firebase.'
    default:
      return 'That did not work. Try again.'
  }
}

/** The Firebase user as the app holds it, plus this phone's passkey. */
function userFrom(user: FbUser): User {
  return {
    id: user.uid,
    name: user.displayName || (user.email ?? '').split('@')[0] || 'You',
    email: user.email ?? '',
    createdAt: Date.parse(user.metadata.creationTime ?? '') || Date.now(),
    passkeyId: loadPasskeyId(user.uid),
  }
}

export interface ExtraState {
  cur: string
  amt: string
  rate: string
  /** Which account the converted money lands in. */
  into?: string
}

/** A plan or income being typed. id is null while it is a new one. */
export interface PlanForm {
  id: string | null
  name: string
  amt: string
  cur: string
  prio: Prio
  date: string
}

export interface IncomeForm {
  id: string | null
  name: string
  amt: string
  cur: string
  date: string
  counted: boolean
}

export interface AccForm {
  id: string | null
  name: string
  kind: Method
  /** '' means the main currency. */
  cur: string
}

export interface PhaseForm {
  id: string | null
  name: string
  from: string
  to: string
}

/** Screens the phone's back button leaves the app from, not walks back from. */
const ROOTS: Screen[] = ['home', 'signin', 'signup', 'error']

export function useApp() {
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<UserData>(freshData)
  const [ready, setReady] = useState(false)

  const [screen, setScreen] = useState<Screen>('signup')
  const [back, setBack] = useState<Screen>('home')

  // recorder
  const [amt, setAmt] = useState('')
  const [acc, setAcc] = useState<string | null>(null)
  const [note, setNote] = useState('')

  // forms
  const [fName, setFName] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fPass, setFPass] = useState('')
  const [fNew, setFNew] = useState('')
  const [fNew2, setFNew2] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newCur, setNewCur] = useState('')
  const [formError, setFormError] = useState('')
  const [errField, setErrField] = useState('')

  // overlays
  const [toast, setToast] = useState<ToastState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // money screens
  const [balCur, setBalCur] = useState('RWF')
  // Keyed "accountId|currency", because a balance now lives in a place.
  const [fBal, setFBal] = useState<Record<string, string>>({})
  const [planForm, setPlanForm] = useState<PlanForm | null>(null)
  const [incomeForm, setIncomeForm] = useState<IncomeForm | null>(null)
  const [fSafety, setFSafety] = useState('')
  const [extra, setExtra] = useState<ExtraState | null>(null)
  const [rateEdit, setRateEdit] = useState<{ code: string; value: string } | null>(null)

  // inline editor
  const [editId, setEditId] = useState<string | null>(null)
  const [eAmt, setEAmt] = useState('')
  const [eNote, setENote] = useState('')
  const [eDetail, setEDetail] = useState('')
  const [eAcc, setEAcc] = useState<string>('cash')
  // The editor can move an expense to another day; recording always stamps
  // the moment it happened.
  const [eDate, setEDate] = useState(today())

  // accounts and phases
  const [accForm, setAccForm] = useState<AccForm | null>(null)
  const [phaseForm, setPhaseForm] = useState<PhaseForm | null>(null)
  const [viewPhase, setViewPhase] = useState<string | null>(null)

  // phases on the History screen: the one being read, a run of expenses
  // being drawn into a new one, and expenses being picked into an old one
  const [histPhase, setHistPhase] = useState<string | null>(null)
  const [selStart, setSelStart] = useState<string | null>(null)
  const [selIds, setSelIds] = useState<string[]>([])
  const [selName, setSelName] = useState('')
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  // A phase the next recorded expense is put into, set from that phase's
  // own page; it is dated today, so an ended phase takes it by hand.
  const [intoPhase, setIntoPhase] = useState<string | null>(null)

  // locking the app with the phone
  const [canUsePhone, setCanUsePhone] = useState(false)
  // true once the reset link has gone out, on the forgot-password screen
  const [sent, setSent] = useState(false)

  const toastT = useRef<number | undefined>(undefined)
  const busyT = useRef<number | undefined>(undefined)

  /* ---------------- derived ---------------- */

  const selCurs = data.selCurs.length ? data.selCurs : ['RWF']
  const mainCur = selCurs.includes(data.mainCur) ? data.mainCur : selCurs[0]
  const activeCur = selCurs.includes(balCur) ? balCur : mainCur

  const fmt = useCallback((n: number) => fmtMoney(n, mainCur), [mainCur])
  const fmtIn = useCallback((n: number, code: string) => fmtMoney(n, code), [])

  /** Pro is a switch on the data, so it follows the person to any phone. */
  const pro = data.settings.pro
  const accounts = data.accounts.length ? data.accounts : freshData().accounts
  /** The ones offered when recording — an account can be kept off that row. */
  const shownAccounts = accounts.filter((a) => !a.hidden)
  /** What the recorder is counting in: the chosen account's own currency, or the main one. */
  const recCur = (acc && accounts.find((a) => a.id === acc)?.cur) || mainCur

  /** The name to show for an account id, even one since removed. */
  const accName = useCallback(
    (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Account',
    [accounts],
  )
  const accKind = useCallback(
    (id: string): Method => accounts.find((a) => a.id === id)?.kind ?? 'cash',
    [accounts],
  )

  /* ---------------- helpers ---------------- */

  const showToast = useCallback((text: string, kind: ToastState['kind'] = 'warn') => {
    window.clearTimeout(toastT.current)
    setToast({ text, kind })
    toastT.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const freeze = useCallback((label: string, ms: number, done: () => void) => {
    setBusy(label)
    setConfirm(null)
    window.clearTimeout(busyT.current)
    busyT.current = window.setTimeout(() => {
      setBusy(null)
      done()
    }, ms)
  }, [])

  const clearErr = useCallback(() => {
    setFormError('')
    setErrField('')
  }, [])

  const fail = useCallback((field: string, msg: string) => {
    setErrField(field)
    setFormError(msg)
  }, [])

  const resetForms = useCallback(() => {
    setFName('')
    setFEmail('')
    setFPass('')
    setFNew('')
    setFNew2('')
    setNewCat('')
    setNewCur('')
    clearErr()
  }, [clearErr])

  /* ---------------- boot ---------------- */

  // True between reading the data down and the first change to it, so
  // arriving at a screen does not immediately write back what was just read.
  const justLoaded = useRef(false)
  // Raised by every local change and lowered once the write lands, so a
  // pull from the server can never land on top of an unsaved edit.
  const dirty = useRef(false)

  /**
   * Firebase holds the session itself, so the app is told who is signed in
   * rather than remembering it: this fires on start-up, after a sign-in or
   * sign-up, and again on sign-out. Their data is read straight after, from
   * the server when there is internet and from the phone's saved copy when
   * there is not.
   */
  const openFor = useCallback(async (fbUser: FbUser) => {
    const acc = userFrom(fbUser)
    let d: UserData
    let carried = false
    try {
      const cloud = await loadCloud(fbUser.uid)
      if (cloud) {
        d = cloud
      } else {
        // Nothing saved under this account yet. If this phone still holds
        // what an older, phone-only version recorded for the same email,
        // that history becomes the account's opening data.
        const legacy = localDataFor(acc.email)
        d = legacy ?? freshData()
        await saveCloud(fbUser.uid, d)
        if (legacy) {
          clearLegacyFor(acc.email)
          carried = true
        }
      }
    } catch {
      // Offline with nothing cached yet. Start on an empty set rather than
      // failing to open; the next save carries whatever is recorded up.
      d = freshData()
    }
    justLoaded.current = true
    setUser(acc)
    setData(d)
    setBalCur(d.selCurs.includes(d.mainCur) ? d.mainCur : d.selCurs[0])
    // A passkey enrolled on this phone turns it into a lock on the app
    // itself: Firebase keeps the session, so the fingerprint is what stands
    // between someone holding the phone and the money on it.
    // A first sign-in — by any route, Google included — opens on the tour
    // once; every one after that opens on the money.
    setScreen(!d.settings.seenTour ? 'tour' : acc.passkeyId ? 'lock' : 'home')
    setBack('home')
    setReady(true)
    if (carried) showToast('Your expenses moved into your account.', 'ok')
  }, [showToast])

  useEffect(() => {
    if (!auth) {
      // The Firebase keys have not been filled in. Say so on the error
      // screen rather than failing silently at the first sign-in.
      setScreen('error')
      setReady(true)
      return
    }
    void passkeyAvailable().then(setCanUsePhone)
    return onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) void openFor(fbUser)
      else {
        setUser(null)
        setData(freshData())
        setScreen((s) => (s === 'signup' ? 'signup' : 'signin'))
        setReady(true)
      }
    })
  }, [openFor])

  /* ---------------- persist ---------------- */

  // Every change is written up, a moment after the typing stops so that a
  // held-down key is one save rather than ten. Firestore queues the write
  // when there is no internet and sends it on reconnection.
  useEffect(() => {
    if (!ready || !user) return
    if (justLoaded.current) {
      justLoaded.current = false
      return
    }
    dirty.current = true
    const t = window.setTimeout(() => {
      void saveCloud(user.id, data)
        .then(() => {
          dirty.current = false
        })
        .catch(() => {
          // Firestore keeps the write and retries; nothing to do here but
          // leave the flag up so a pull cannot overwrite it meanwhile.
        })
    }, 700)
    return () => window.clearTimeout(t)
  }, [ready, user, data])

  // Coming back to the app is when another phone's work should appear. Only
  // when nothing local is waiting to be written, so a pull never wins over
  // an edit that has not gone up yet.
  useEffect(() => {
    if (!ready || !user) return
    const onShow = () => {
      if (document.visibilityState !== 'visible' || dirty.current) return
      void loadCloud(user.id)
        .then((cloud) => {
          if (!cloud || dirty.current) return
          justLoaded.current = true
          setData(cloud)
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [ready, user])

  /* ---------------- live rates ---------------- */

  useEffect(() => {
    if (!ready || !user) return
    const ctl = new AbortController()
    let cancelled = false
    void (async () => {
      const fresh = await fetchRates(data.allCurs, ctl.signal)
      if (!fresh || cancelled) return
      setData((d) => {
        const next = { ...d.rates }
        for (const [code, value] of Object.entries(fresh)) {
          // Never overwrite a rate the person typed themselves.
          if (d.manualRates.includes(code)) continue
          next[code] = value
        }
        return { ...d, rates: next, ratesFetchedAt: Date.now() }
      })
    })()
    return () => {
      cancelled = true
      ctl.abort()
    }
    // Refreshing once per sign-in is enough; the person can always edit a rate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id])

  useEffect(() => {
    return () => {
      window.clearTimeout(toastT.current)
      window.clearTimeout(busyT.current)
    }
  }, [])

  const go = useCallback(
    (next: Screen, from: Screen = 'home') => {
      setScreen(next)
      setBack(from)
      resetForms()
      setEditId(null)
      setPlanForm(null)
      setIncomeForm(null)
      setSelStart(null)
      setSelIds([])
      setSelName('')
      setPickFor(null)
      setPicked([])
      setIntoPhase(null)
    },
    [resetForms],
  )

  const goBack = useCallback(() => {
    go(screen === 'stats' || screen === 'profile' ? 'home' : back)
  }, [go, screen, back])

  /* ---------------- the phone's back button ---------------- */

  // The app is one page, so the phone's back button would close it from any
  // screen. One spare history entry is kept above the real one; pressing
  // back pops it, which closes whatever is open — the confirm sheet, an
  // expense editor, a plan or income form — or walks one screen back, and
  // the entry is put back for the next press. On home or sign-in nothing is
  // re-armed, so pressing back there leaves the app, as the phone expects.
  const armed = useRef(false)
  const onHardwareBack = useRef<() => boolean>(() => false)
  onHardwareBack.current = () => {
    if (busy) return true
    if (confirm) {
      setConfirm(null)
      return true
    }
    if (editId) {
      setEditId(null)
      return true
    }
    if (selStart || pickFor) {
      cancelSelect()
      return true
    }
    if (planForm) {
      setPlanForm(null)
      return true
    }
    if (incomeForm) {
      setIncomeForm(null)
      return true
    }
    if (ROOTS.includes(screen)) return false
    const dest = screen === 'stats' || screen === 'profile' ? 'home' : back
    goBack()
    return !ROOTS.includes(dest)
  }

  useEffect(() => {
    const onPop = () => {
      armed.current = false
      if (onHardwareBack.current()) {
        history.pushState({ byuma: true }, '')
        armed.current = true
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!ready) return
    const needsGuard =
      !ROOTS.includes(screen) ||
      !!confirm ||
      !!editId ||
      !!planForm ||
      !!incomeForm ||
      !!selStart ||
      !!pickFor
    if (needsGuard && !armed.current) {
      history.pushState({ byuma: true }, '')
      armed.current = true
    }
  }, [ready, screen, confirm, editId, planForm, incomeForm, selStart, pickFor])

  /* ---------------- auth ---------------- */

  /**
   * Make the account with Firebase. Nothing is written here beyond the
   * name: onAuthStateChanged hears about the new user and opens the app
   * for them, which is also what seeds their first saved data.
   */
  const signUp = useCallback(async () => {
    if (!auth) return
    if (!fName.trim()) return fail('name', 'Your name is missing.')
    if (!emailOk(fEmail)) return fail('email', 'That email does not look right.')
    if (fPass.length < 8) return fail('pass', 'Use at least 8 characters.')

    setBusy('Creating your account')
    try {
      const cred = await createUserWithEmailAndPassword(auth, fEmail.trim(), fPass)
      await updateProfile(cred.user, { displayName: fName.trim() })
      resetForms()
    } catch (err) {
      const code = (err as { code?: string })?.code ?? ''
      fail(code.includes('email') ? 'email' : 'pass', authMessage(err))
    } finally {
      setBusy(null)
    }
  }, [fName, fEmail, fPass, fail, resetForms])

  const signIn = useCallback(async () => {
    if (!auth) return
    if (!emailOk(fEmail)) return fail('email', 'That email does not look right.')
    if (!fPass) return fail('pass', 'Enter your password.')

    setBusy('Signing in')
    try {
      await signInWithEmailAndPassword(auth, fEmail.trim(), fPass)
      resetForms()
      showToast('Signed in.', 'ok')
    } catch (err) {
      fail('pass', authMessage(err))
    } finally {
      setBusy(null)
    }
  }, [fEmail, fPass, fail, resetForms, showToast])

  /**
   * Google, in a popup rather than a redirect: a redirect loses the page
   * and comes back through a round trip that installed web apps handle
   * badly. If the popup is blocked the person is told, rather than left
   * looking at a screen that did nothing.
   *
   * Someone who first signed up with a password and then uses Google on
   * the same address is one account, not two — Firebase links them when
   * the address is verified, which Google's always is.
   */
  const signInWithGoogle = useCallback(async () => {
    if (!auth) return
    setBusy('Signing in')
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithPopup(auth, provider)
      resetForms()
      showToast('Signed in.', 'ok')
    } catch (err) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // They shut the window themselves; nothing to report.
      } else if (code === 'auth/popup-blocked') {
        fail('pass', 'Your browser blocked the Google window. Allow it and try again.')
      } else {
        fail('pass', authMessage(err))
      }
    } finally {
      setBusy(null)
    }
  }, [fail, resetForms, showToast])

  const askSignOut = useCallback(() => {
    setConfirm({
      title: 'Sign out?',
      body: 'Your expenses stay in your account. You will need your password to get back in.',
      cta: 'Sign out',
      yes: () =>
        freeze('Signing out', FREEZE.signOut, () => {
          // The listener clears the account and lands on the sign-in screen.
          void signOut(auth!)
          resetForms()
          showToast('Signed out.', 'ok')
        }),
    })
  }, [freeze, resetForms, showToast])

  /* ---------------- unlocking with the phone ---------------- */

  /**
   * Firebase keeps you signed in, so the fingerprint is no longer how you
   * get an account back — it is what keeps whoever picks up the phone out
   * of it. Passing it opens the app; failing it leaves the lock in place.
   */
  const unlockWithPhone = useCallback(async () => {
    if (!user?.passkeyId) return
    const ok = await verifyPasskey(user.passkeyId)
    if (!ok) return fail('pass', 'That did not match. Try again.')
    freeze('Opening', FREEZE.unlock, () => {
      setScreen('home')
      setBack('home')
      clearErr()
    })
  }, [user, fail, freeze, clearErr])

  /** Ask the phone to guard this account, from Profile. */
  const enablePhoneUnlock = useCallback(async () => {
    if (!user) return
    const id = await registerPasskey(user.id, user.email, user.name)
    if (!id) return showToast('Your phone did not confirm it.')
    savePasskeyId(user.id, id)
    setUser({ ...user, passkeyId: id })
    showToast('Phone lock is on.', 'ok')
  }, [user, showToast])

  const disablePhoneUnlock = useCallback(() => {
    if (!user) return
    setConfirm({
      title: 'Turn off phone lock?',
      body: 'The app will open without asking for your fingerprint.',
      cta: 'Turn off',
      yes: () => {
        clearPasskeyId(user.id)
        setUser({ ...user, passkeyId: undefined })
        showToast('Phone lock is off.', 'ok')
      },
    })
  }, [user, showToast])

  /* ---------------- forgot password ---------------- */

  const goForgot = useCallback(() => {
    setSent(false)
    setScreen('forgot')
    setBack('signin')
    setFPass('')
    clearErr()
  }, [clearErr])

  /**
   * There is a mail server behind the app now: Firebase sends the reset
   * link itself, so a forgotten password is a link in the inbox rather
   * than something this phone has to vouch for.
   *
   * It reports success whether or not that email has an account, which is
   * deliberate — otherwise this screen would tell a stranger which of your
   * friends is registered.
   */
  const sendReset = useCallback(async () => {
    if (!auth) return
    if (!emailOk(fEmail)) return fail('email', 'That email does not look right.')
    setBusy('Sending')
    try {
      await sendPasswordResetEmail(auth, fEmail.trim())
      setSent(true)
      clearErr()
    } catch (err) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/user-not-found') setSent(true)
      else fail('email', authMessage(err))
    } finally {
      setBusy(null)
    }
  }, [fEmail, fail, clearErr])

  /* ---------------- recorder ---------------- */

  const num = toNumber(amt)

  const record = useCallback(() => {
    if (num <= 0) return
    if (!acc) return showToast('Pick where it came from first.')
    const item: Expense = {
      id: newId(),
      amount: num,
      acc,
      note: note.trim(),
      // Spent in the account's own currency: dollars out of "Cash USD".
      cur: recCur,
      at: Date.now(),
    }
    const target = intoPhase ? data.phases.find((p) => p.id === intoPhase) : undefined
    setData((d) => ({
      ...d,
      items: [item, ...d.items],
      // Recording spends the money, so the total comes down by itself.
      balances: applyRecord(d.balances, item),
      // A note typed by hand becomes a category, ready as a chip next time.
      cats: rememberCategory(d.cats, item.note),
      cleared: false,
      // Into a phase: by hand, since today may be outside its dates.
      phases: target
        ? d.phases.map((p) =>
            p.id === target.id && !inPhase(p, item.at)
              ? { ...p, items: [...(p.items ?? []), item.id] }
              : p,
          )
        : d.phases,
    }))
    setAmt('')
    setNote('')
    setAcc(null)
    if (target) {
      // Back to the phase it went into.
      setIntoPhase(null)
      setHistPhase(target.id)
      setScreen('history')
      setBack('home')
      showToast('Recorded ' + fmtIn(num, recCur) + ' into ' + target.name + '.', 'ok')
      return
    }
    showToast('Recorded ' + fmtIn(num, recCur) + '.', 'ok')
  }, [num, acc, note, recCur, intoPhase, data.phases, fmtIn, showToast])

  const askDelete = useCallback(
    (item: Expense) => {
      setEditId(null)
      setConfirm({
        title: 'Delete this expense?',
        body:
          fmtIn(item.amount, item.cur) +
          ' · ' +
          (item.note || accName(item.acc)),
        cta: 'Delete',
        danger: true,
        yes: () =>
          freeze('Deleting', FREEZE.deleteOne, () => {
            setData((d) => ({
              ...d,
              items: d.items.filter((x) => x.id !== item.id),
              // Undoing the spend puts the money back.
              balances: applyDelete(d.balances, item),
            }))
            showToast('Expense deleted.', 'ok')
          }),
      })
    },
    [freeze, showToast, fmtIn],
  )

  const openEditor = useCallback(
    (item: Expense) => {
      if (editId === item.id) {
        setEditId(null)
        return
      }
      setEditId(item.id)
      setEAmt(String(item.amount))
      setENote(item.note)
      setEDetail(item.detail ?? '')
      setEAcc(item.acc)
      setEDate(dayInput(item.at))
    },
    [editId],
  )

  const saveEdit = useCallback(
    (item: Expense) => {
      const v = toNumber(eAmt)
      if (v <= 0) {
        showToast('Amount cannot be zero.')
        return
      }
      setData((d) => ({
        ...d,
        items: d.items.map((x) =>
          x.id === item.id
            ? {
                ...x,
                amount: v,
                note: eNote.trim(),
                detail: eDetail.trim() || undefined,
                acc: eAcc,
                at: atOn(eDate, item.at),
              }
            : x,
        ),
        // Only the difference moves — unless it changed account, and then
        // the whole amount goes back and comes out of the new one.
        balances: applyEdit(d.balances, item, v, eAcc),
        cats: rememberCategory(d.cats, eNote),
      }))
      setEditId(null)
      showToast('Expense updated.', 'ok')
    },
    [eAmt, eNote, eDetail, eAcc, eDate, showToast],
  )

  const askClear = useCallback(() => {
    if (!data.items.length) return showToast('Nothing to delete.')
    setConfirm({
      title: 'Delete all expenses?',
      body: 'All ' + data.items.length + ' of them. This cannot be undone.',
      cta: 'Delete all',
      danger: true,
      yes: () =>
        freeze('Deleting everything', FREEZE.deleteAll, () => {
          setData((d) => ({
            ...d,
            items: [],
            balances: applyDeleteAll(d.balances, d.items),
            cleared: true,
          }))
          setScreen('home')
          showToast('All expenses deleted.', 'ok')
        }),
    })
  }, [data.items.length, freeze, showToast])

  /* ---------------- balance ---------------- */

  // `from` is where the back chevron returns to. Analytics is the usual way
  // in, but the empty home screen also offers it to a person who has not set
  // a balance yet.
  const goBalance = useCallback(
    (from: Screen = 'stats') => {
      const next: Record<string, string> = {}
      for (const a of data.accounts) {
        for (const c of selCurs) {
          const held = data.balances[a.id]?.[c]
          next[a.id + '|' + c] = held ? String(held) : ''
        }
      }
      setFBal(next)
      setExtra(null)
      clearErr()
      setScreen('balance')
      setBack(from)
    },
    [selCurs, data.accounts, data.balances, clearErr],
  )

  /* ---------------- plans, safety net, expected income ---------------- */

  const goPlans = useCallback(() => {
    setPlanForm(null)
    setIncomeForm(null)
    setFSafety(data.safety.amt ? String(data.safety.amt) : '')
    clearErr()
    setScreen('plans')
    setBack('stats')
  }, [data.safety.amt, clearErr])

  /**
   * Open the form empty for a new plan, or filled to edit one — dropped in
   * right under its own row. Tapping the row again folds it away.
   */
  const openPlanForm = useCallback(
    (p?: Plan) => {
      setIncomeForm(null)
      setPlanForm((cur) => {
        if (p && cur && cur.id === p.id) return null
        return p
          ? { id: p.id, name: p.name, amt: String(p.amt), cur: p.cur, prio: p.prio, date: p.date }
          : { id: null, name: '', amt: '', cur: mainCur, prio: 1, date: '' }
      })
      clearErr()
    },
    [mainCur, clearErr],
  )

  const savePlan = useCallback(() => {
    if (!planForm) return
    const name = planForm.name.trim()
    const amt = Number(planForm.amt) || 0
    if (!name) return fail('pname', 'Say what it is.')
    if (amt <= 0) return fail('pamt', 'Give it an amount.')
    const saved: Plan = {
      id: planForm.id ?? newId(),
      name,
      amt,
      cur: planForm.cur,
      prio: planForm.prio,
      date: planForm.date,
    }
    setData((d) => ({
      ...d,
      plans: planForm.id
        ? d.plans.map((p) => (p.id === planForm.id ? saved : p))
        : [...d.plans, saved],
    }))
    setPlanForm(null)
    showToast(planForm.id ? 'Plan updated.' : 'Plan added.', 'ok')
  }, [planForm, fail, showToast])

  const askDeletePlan = useCallback(
    (p: Plan) => {
      setConfirm({
        title: 'Remove ' + p.name + '?',
        body: fmtIn(p.amt, p.cur) + ' · P' + p.prio + '. Its share comes back to spendable.',
        cta: 'Remove',
        danger: true,
        yes: () => {
          setData((d) => ({ ...d, plans: d.plans.filter((x) => x.id !== p.id) }))
          setPlanForm(null)
          showToast('Plan removed.', 'ok')
        },
      })
    },
    [fmtIn, showToast],
  )

  const openIncomeForm = useCallback(
    (i?: Income) => {
      setPlanForm(null)
      setIncomeForm((cur) => {
        if (i && cur && cur.id === i.id) return null
        return i
          ? { id: i.id, name: i.name, amt: String(i.amt), cur: i.cur, date: i.date, counted: i.counted }
          : { id: null, name: '', amt: '', cur: mainCur, date: '', counted: false }
      })
      clearErr()
    },
    [mainCur, clearErr],
  )

  const saveIncome = useCallback(() => {
    if (!incomeForm) return
    const name = incomeForm.name.trim()
    const amt = Number(incomeForm.amt) || 0
    if (!name) return fail('iname', 'Say where it comes from.')
    if (amt <= 0) return fail('iamt', 'Give it an amount.')
    const saved: Income = {
      id: incomeForm.id ?? newId(),
      name,
      amt,
      cur: incomeForm.cur,
      date: incomeForm.date,
      counted: incomeForm.counted,
    }
    setData((d) => ({
      ...d,
      incomes: incomeForm.id
        ? d.incomes.map((i) => (i.id === incomeForm.id ? saved : i))
        : [...d.incomes, saved],
    }))
    setIncomeForm(null)
    showToast(incomeForm.id ? 'Income updated.' : 'Income added.', 'ok')
  }, [incomeForm, fail, showToast])

  const askDeleteIncome = useCallback(
    (i: Income) => {
      setConfirm({
        title: 'Remove ' + i.name + '?',
        body: fmtIn(i.amt, i.cur) + (i.counted ? '. It stops counting into spendable.' : '.'),
        cta: 'Remove',
        danger: true,
        yes: () => {
          setData((d) => ({ ...d, incomes: d.incomes.filter((x) => x.id !== i.id) }))
          setIncomeForm(null)
          showToast('Income removed.', 'ok')
        },
      })
    },
    [fmtIn, showToast],
  )

  /** The switch on an income row: count it into spendable, or not. */
  const toggleCounted = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      incomes: d.incomes.map((i) => (i.id === id ? { ...i, counted: !i.counted } : i)),
    }))
  }, [])

  /** Typing only stages the safety net; the Set button makes it count. */
  const editSafety = useCallback(
    (raw: string) => {
      setFSafety(clean(raw))
      clearErr()
    },
    [clearErr],
  )

  const saveSafety = useCallback(() => {
    const amt = Number(fSafety) || 0
    if (amt <= 0) return fail('safety', 'Give it an amount first.')
    setData((d) => ({ ...d, safety: { ...d.safety, amt } }))
    clearErr()
    showToast('Safety net set.', 'ok')
  }, [fSafety, fail, clearErr, showToast])

  const resetSafety = useCallback(() => {
    setData((d) => ({ ...d, safety: { ...d.safety, amt: 0 } }))
    setFSafety('')
    clearErr()
    showToast('Safety net reset.', 'ok')
  }, [clearErr, showToast])

  const setSafetyCur = useCallback((cur: string) => {
    setData((d) => ({ ...d, safety: { ...d.safety, cur } }))
  }, [])

  const saveBalance = useCallback(() => {
    const vals: Record<string, Record<string, number>> = {}
    let anything = 0
    for (const a of data.accounts) {
      const held: Record<string, number> = {}
      for (const c of selCurs) {
        const key = a.id + '|' + c
        const raw = (fBal[key] ?? '').trim()
        if (raw && isNaN(Number(raw))) return fail('bal' + key, 'That is not a number.')
        held[c] = Number(raw) || 0
        anything += held[c]
      }
      vals[a.id] = held
    }
    let added = 0
    if (extra && extra.amt) {
      const a = Number(extra.amt) || 0
      const r = Number(extra.rate) || 0
      if (a > 0 && r <= 0) return fail('exrate', 'Set a rate first.')
      added = a * r
    }
    if (anything <= 0 && added <= 0) {
      return fail('bal' + data.accounts[0].id + '|' + selCurs[0], 'Enter at least one total.')
    }
    // Money brought in from another currency lands in the first account,
    // which is where the person is standing when they add it.
    if (added > 0) {
      const into = extra?.into && vals[extra.into] ? extra.into : data.accounts[0].id
      vals[into] = { ...vals[into], [mainCur]: (vals[into]?.[mainCur] ?? 0) + added }
    }

    freeze('Saving balance', FREEZE.saveBalance, () => {
      setData((d) => ({ ...d, balances: vals }))
      setExtra(null)
      setScreen('stats')
      showToast(
        added > 0
          ? 'Balance updated with ' + fmtIn(added, mainCur) + ' added.'
          : 'Balance updated.',
        'ok',
      )
    })
  }, [data.accounts, selCurs, fBal, extra, mainCur, fail, freeze, showToast, fmtIn])

  /* ---------------- rates ---------------- */

  const shownRate = useCallback(
    (code: string) =>
      rateEdit && rateEdit.code === code
        ? rateEdit.value
        : String(estRate(data.rates, code, mainCur)),
    [rateEdit, data.rates, mainCur],
  )

  const editRate = useCallback(
    (code: string, raw: string) => {
      const value = clean(raw)
      setRateEdit({ code, value })
      const n = Number(value)
      if (!value || !n || n <= 0) return
      setData((d) => ({
        ...d,
        rates: withRate(d.rates, code, n, mainCur),
        manualRates: d.manualRates.includes(code)
          ? d.manualRates
          : [...d.manualRates, code],
      }))
    },
    [mainCur],
  )

  /* ---------------- currencies ---------------- */

  const openExtra = useCallback(() => {
    const other = data.allCurs.find((c) => !selCurs.includes(c))
    if (!other) return showToast('Add a currency in your profile first.')
    setExtra({ cur: other, amt: '', rate: String(estRate(data.rates, other, mainCur)) })
    clearErr()
  }, [data.allCurs, data.rates, selCurs, mainCur, showToast, clearErr])

  const addCur = useCallback(() => {
    const n = newCur.trim()
    if (n.length < 2) return fail('cur', 'Use 2 to 4 letters.')
    if (data.allCurs.includes(n)) return fail('cur', 'You already have that one.')
    setData((d) => ({ ...d, allCurs: [...d.allCurs, n] }))
    setNewCur('')
    clearErr()
    showToast(n + ' added.', 'ok')
  }, [newCur, data.allCurs, fail, clearErr, showToast])

  const toggleCur = useCallback(
    (code: string) => {
      const on = selCurs.includes(code)
      if (on) {
        if (selCurs.length <= 1) return showToast('Keep at least one currency.')
        const next = selCurs.filter((x) => x !== code)
        setData((d) => ({
          ...d,
          selCurs: next,
          mainCur: code === d.mainCur ? next[0] : d.mainCur,
        }))
        setBalCur((b) => (next.includes(b) ? b : next[0]))
        setExtra(null)
      } else {
        if (selCurs.length >= 3) return showToast('Three at a time. Unpick one first.')
        setData((d) => ({
          ...d,
          selCurs: [...selCurs, code],
          balances: { ...d.balances, [code]: d.balances[code] ?? 0 },
        }))
        setExtra(null)
      }
    },
    [selCurs, showToast],
  )

  const removeCur = useCallback(
    (code: string) => {
      if (selCurs.includes(code)) return showToast('Unpick it first.')
      setData((d) => ({ ...d, allCurs: d.allCurs.filter((x) => x !== code) }))
      showToast(code + ' removed.', 'ok')
    },
    [selCurs, showToast],
  )

  const canRemoveCur = useCallback((code: string) => !BASE_CURS.includes(code), [])

  /* ---------------- categories ---------------- */

  const addCat = useCallback(() => {
    const n = newCat.trim()
    if (!n) return fail('cat', 'Type a name first.')
    if (n.length > 18) return fail('cat', 'Keep it under 18 characters.')
    if (data.cats.some((c) => c.toLowerCase() === n.toLowerCase())) {
      return fail('cat', 'You already have that one.')
    }
    setData((d) => ({ ...d, cats: [...d.cats, n] }))
    setNewCat('')
    clearErr()
    showToast(n + ' added.', 'ok')
  }, [newCat, data.cats, fail, clearErr, showToast])

  const removeCat = useCallback(
    (name: string) => {
      setConfirm({
        title: 'Remove ' + name + '?',
        body: 'Expenses already filed under it keep their label.',
        cta: 'Remove',
        danger: true,
        yes: () => {
          setData((d) => ({ ...d, cats: d.cats.filter((x) => x !== name) }))
          showToast(name + ' removed.', 'ok')
        },
      })
    },
    [showToast],
  )

  /* ---------------- profile edits ---------------- */

  const saveName = useCallback(async () => {
    if (!auth?.currentUser) return
    if (!fName.trim()) return fail('name', 'Your name is missing.')
    const next = fName.trim()
    try {
      await updateProfile(auth.currentUser, { displayName: next })
    } catch (err) {
      return fail('name', authMessage(err))
    }
    freeze('Saving', FREEZE.saveName, () => {
      setUser((a) => (a ? { ...a, name: next } : a))
      setScreen('profile')
      resetForms()
      showToast('Name changed.', 'ok')
    })
  }, [fName, fail, freeze, resetForms, showToast])

  /** Prove it is really them before a change that touches the user. */
  const reauth = useCallback(async (password: string) => {
    const user = auth?.currentUser
    if (!user?.email) throw new Error('not signed in')
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, password),
    )
  }, [])

  /**
   * Changing the email is the one thing that does not take effect at once:
   * Firebase sends a link to the new address first, and the user moves
   * over only when that link is opened. That is what stops someone typing
   * an address they cannot read and locking themselves out.
   */
  const saveEmail = useCallback(async () => {
    const fbUser = auth?.currentUser
    if (!user || !fbUser) return
    if (!emailOk(fEmail)) return fail('email', 'That email does not look right.')
    if (fEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      return fail('email', 'That is already your email.')
    }
    if (!fPass) return fail('pass', 'Enter your password to confirm.')
    const next = fEmail.trim()
    try {
      await reauth(fPass)
    } catch (err) {
      return fail('pass', authMessage(err))
    }
    setConfirm({
      title: 'Change your email?',
      body: 'A link goes to ' + next + '. Open it and that becomes your sign-in.',
      cta: 'Send the link',
      yes: () => {
        void (async () => {
          setBusy('Sending')
          try {
            await verifyBeforeUpdateEmail(fbUser, next)
            setScreen('profile')
            resetForms()
            showToast('Link sent. Open it to finish.', 'ok')
          } catch (err) {
            fail('email', authMessage(err))
          } finally {
            setBusy(null)
          }
        })()
      },
    })
  }, [user, fEmail, fPass, fail, reauth, resetForms, showToast])

  const savePassword = useCallback(async () => {
    const fbUser = auth?.currentUser
    if (!user || !fbUser) return
    if (!fPass) return fail('pass', 'Enter your current password.')
    if (fNew.length < 8) return fail('new', 'New password needs 8 characters.')
    if (fNew !== fNew2) return fail('new2', 'The two new passwords do not match.')
    if (fNew === fPass) return fail('new', 'Pick a password you have not used.')
    try {
      await reauth(fPass)
    } catch (err) {
      return fail('pass', authMessage(err))
    }
    const next = fNew
    setConfirm({
      title: 'Change your password?',
      body: 'You stay signed in on this phone. Other phones sign out.',
      cta: 'Change',
      yes: () => {
        void (async () => {
          setBusy('Saving')
          try {
            await updatePassword(fbUser, next)
            setScreen('profile')
            resetForms()
            showToast('Password changed.', 'ok')
          } catch (err) {
            fail('new', authMessage(err))
          } finally {
            setBusy(null)
          }
        })()
      },
    })
  }, [user, fPass, fNew, fNew2, fail, reauth, resetForms, showToast])

  /**
   * The whole user, gone: the saved data, then the Firebase user
   * itself. Said plainly before anything happens, and it now means every
   * phone rather than only this one.
   */
  const askDeleteAccount = useCallback(() => {
    if (!user) return
    setConfirm({
      title: 'Delete your account?',
      body:
        'Your account and everything saved under ' +
        user.email +
        ' are deleted, on every phone. This cannot be undone.',
      cta: 'Delete user',
      danger: true,
      yes: () => {
        void (async () => {
          setBusy('Deleting user')
          const user = auth?.currentUser
          if (!user) return setBusy(null)
          try {
            await deleteCloud(user.uid)
            clearPasskeyId(user.uid)
            clearLegacyFor(user?.email ?? '')
            await deleteUser(user)
            resetForms()
            showToast('Account deleted.', 'ok')
          } catch (err) {
            showToast(authMessage(err))
          } finally {
            setBusy(null)
          }
        })()
      },
    })
  }, [user, resetForms, showToast])

  const setSetting = useCallback((key: keyof Settings) => {
    setData((d) => ({ ...d, settings: { ...d.settings, [key]: !d.settings[key] } }))
  }, [])

  const setMainCur = useCallback((code: string) => {
    setData((d) => ({ ...d, mainCur: code }))
    setBalCur(code)
  }, [])

  /* ---------------- accounts ---------------- */

  const goAccounts = useCallback(() => {
    setAccForm(null)
    clearErr()
    setScreen('accounts')
    setBack('profile')
  }, [clearErr])

  /** Open the form empty for a new account, or filled to rename one. */
  const openAccForm = useCallback(
    (a?: Account) => {
      setAccForm((cur) => {
        if (a && cur && cur.id === a.id) return null
        return a
          ? { id: a.id, name: a.name, kind: a.kind, cur: a.cur ?? '' }
          : { id: null, name: '', kind: 'bank' as Method, cur: '' }
      })
      clearErr()
    },
    [clearErr],
  )

  const saveAcc = useCallback(() => {
    if (!accForm) return
    const name = accForm.name.trim()
    if (!name) return fail('accname', 'Give it a name.')
    if (name.length > 18) return fail('accname', 'Keep it under 18 characters.')
    const clash = data.accounts.some(
      (a) => a.id !== accForm.id && a.name.toLowerCase() === name.toLowerCase(),
    )
    if (clash) return fail('accname', 'You already have one with that name.')

    setData((d) => ({
      ...d,
      // Never leave a key holding undefined: Firestore refuses the whole
      // document, and the save fails without a word.
      accounts: accForm.id
        ? d.accounts.map((a) => {
            if (a.id !== accForm.id) return a
            const { cur: _dropped, ...rest } = a
            return { ...rest, name, kind: accForm.kind, ...(accForm.cur ? { cur: accForm.cur } : {}) }
          })
        : [
            ...d.accounts,
            {
              id: newId(),
              name,
              kind: accForm.kind,
              custom: true,
              ...(accForm.cur ? { cur: accForm.cur } : {}),
            },
          ],
    }))
    setAccForm(null)
    showToast(accForm.id ? 'Account updated.' : name + ' added.', 'ok')
  }, [accForm, data.accounts, fail, showToast])

  /** One of the three standard accounts, put back on the list. */
  const addStandard = useCallback(
    (id: string) => {
      const std = STANDARD.find((a) => a.id === id)
      if (!std) return
      setData((d) =>
        d.accounts.some((a) => a.id === id)
          ? d
          : { ...d, accounts: [...d.accounts, { ...std }] },
      )
      showToast(std.name + ' added.', 'ok')
    },
    [showToast],
  )

  /**
   * Removing an account is refused while money or expenses still point at
   * it — silently dropping either would make the books lie.
   */
  const askRemoveAcc = useCallback(
    (a: Account) => {
      if (data.accounts.length <= 1) return showToast('Keep at least one account.')
      const spent = data.items.some((i) => i.acc === a.id)
      if (spent) return showToast('Expenses came out of ' + a.name + '. It stays.')
      const held = Object.values(data.balances[a.id] ?? {}).some((v) => v !== 0)
      if (held) return showToast('Move what is in ' + a.name + ' to zero first.')
      setConfirm({
        title: 'Remove ' + a.name + '?',
        body: 'Nothing has been spent from it and it holds nothing.',
        cta: 'Remove',
        danger: true,
        yes: () => {
          setData((d) => {
            const balances = { ...d.balances }
            delete balances[a.id]
            return { ...d, accounts: d.accounts.filter((x) => x.id !== a.id), balances }
          })
          setAccForm(null)
          showToast(a.name + ' removed.', 'ok')
        },
      })
    },
    [data.accounts.length, data.items, data.balances, showToast],
  )

  /* ---------------- phases ---------------- */

  const goPhases = useCallback(() => {
    setPhaseForm(null)
    clearErr()
    setScreen('phases')
    setBack('stats')
  }, [clearErr])

  const openPhase = useCallback(
    (id: string, from: Screen = 'phases') => {
      setViewPhase(id)
      setScreen('phase')
      setBack(from)
    },
    [],
  )

  const openPhaseForm = useCallback(
    (ph?: Phase) => {
      setPhaseForm((cur) => {
        if (ph && cur && cur.id === ph.id) return null
        return ph
          ? { id: ph.id, name: ph.name, from: ph.from, to: ph.to }
          : { id: null, name: '', from: today(), to: '' }
      })
      clearErr()
    },
    [clearErr],
  )

  const savePhase = useCallback(() => {
    if (!phaseForm) return
    const name = phaseForm.name.trim()
    if (!name) return fail('phname', 'Give the phase a name.')
    if (!phaseForm.from) return fail('phfrom', 'Say when it started.')
    if (phaseForm.to && phaseForm.to < phaseForm.from) {
      return fail('phto', 'It cannot end before it started.')
    }
    const kept = phaseForm.id ? data.phases.find((x) => x.id === phaseForm.id)?.items : undefined
    const saved: Phase = {
      id: phaseForm.id ?? newId(),
      name,
      from: phaseForm.from,
      to: phaseForm.to,
      ...(kept?.length ? { items: kept } : {}),
    }
    setData((d) => ({
      ...d,
      phases: phaseForm.id
        ? d.phases.map((x) => (x.id === phaseForm.id ? saved : x))
        : [...d.phases, saved],
    }))
    setPhaseForm(null)
    showToast(phaseForm.id ? 'Phase updated.' : name + ' added.', 'ok')
  }, [phaseForm, data.phases, fail, showToast])

  /** Close a running phase today, which is how one season becomes the last. */
  const endPhase = useCallback(
    (ph: Phase) => {
      setData((d) => ({
        ...d,
        phases: d.phases.map((x) => (x.id === ph.id ? { ...x, to: today() } : x)),
      }))
      showToast(ph.name + ' ended today.', 'ok')
    },
    [showToast],
  )

  const askRemovePhase = useCallback(
    (ph: Phase) => {
      setConfirm({
        title: 'Remove ' + ph.name + '?',
        body: 'The expenses stay exactly where they are — only the name for that stretch goes.',
        cta: 'Remove',
        danger: true,
        yes: () => {
          setData((d) => ({ ...d, phases: d.phases.filter((x) => x.id !== ph.id) }))
          setPhaseForm(null)
          setHistPhase((cur) => (cur === ph.id ? null : cur))
          if (viewPhase === ph.id) setScreen('phases')
          showToast('Phase removed.', 'ok')
        },
      })
    },
    [viewPhase, showToast],
  )

  /* ---------------- pro ---------------- */

  const goPro = useCallback(() => {
    setScreen('pro')
    setBack('profile')
  }, [])

  /* ---------------- phases on the History screen ---------------- */

  /**
   * Drawing a phase around a run of expenses: hold the first, tap the last.
   * The run is every expense between the two on the timeline, whichever
   * order they were touched in.
   */
  const startSelect = useCallback((id: string) => {
    setPickFor(null)
    setPicked([])
    setSelIds([])
    setSelName('')
    setSelStart(id)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12)
  }, [])

  const cancelSelect = useCallback(() => {
    setSelStart(null)
    setSelIds([])
    setSelName('')
    setPickFor(null)
    setPicked([])
    clearErr()
  }, [clearErr])

  /**
   * What a tap on a row means depends on what is going on: the end of a run
   * being drawn, an expense being picked into a phase, or just the editor.
   */
  const tapRow = useCallback(
    (item: Expense) => {
      if (pickFor) {
        setPicked((cur) =>
          cur.includes(item.id) ? cur.filter((x) => x !== item.id) : [...cur, item.id],
        )
        return
      }
      if (selStart) {
        if (selIds.length) return
        const order = data.items.map((i) => i.id)
        const a = order.indexOf(selStart)
        const b = order.indexOf(item.id)
        if (a < 0 || b < 0) return
        setSelIds(order.slice(Math.min(a, b), Math.max(a, b) + 1))
        return
      }
      openEditor(item)
    },
    [pickFor, selStart, selIds.length, data.items, openEditor],
  )

  /** The run becomes a phase: dated from its first expense to its last. */
  const savePhaseFromSelection = useCallback(() => {
    const name = selName.trim()
    if (!name) return fail('selname', 'Give it a name.')
    const chosen = data.items.filter((i) => selIds.includes(i.id))
    if (!chosen.length) return
    const at = chosen.map((i) => i.at)
    const ph: Phase = {
      id: newId(),
      name,
      from: dayInput(Math.min(...at)),
      to: dayInput(Math.max(...at)),
      items: selIds.slice(),
    }
    setData((d) => ({ ...d, phases: [...d.phases, ph] }))
    setSelStart(null)
    setSelIds([])
    setSelName('')
    setHistPhase(ph.id)
    clearErr()
    showToast(name + ' added.', 'ok')
  }, [selName, selIds, data.items, fail, clearErr, showToast])

  /** Picking expenses from outside a phase's dates into it. */
  const startPick = useCallback((ph: Phase) => {
    setSelStart(null)
    setSelIds([])
    setSelName('')
    setPickFor(ph.id)
    setPicked([])
  }, [])

  const savePick = useCallback(() => {
    if (!pickFor) return
    const n = picked.length
    setData((d) => ({
      ...d,
      phases: d.phases.map((p) =>
        p.id === pickFor
          ? { ...p, items: Array.from(new Set([...(p.items ?? []), ...picked])) }
          : p,
      ),
    }))
    setPickFor(null)
    setPicked([])
    if (n) showToast(n === 1 ? '1 expense added.' : n + ' expenses added.', 'ok')
  }, [pickFor, picked, showToast])

  /** From a phase's page: record one, and it lands in that phase. */
  const recordInto = useCallback(
    (ph: Phase) => {
      setIntoPhase(ph.id)
      setScreen('home')
      setBack('home')
    },
    [],
  )

  /** Take one back out of a phase it was put into by hand. */
  const unpickFrom = useCallback((ph: Phase, id: string) => {
    setData((d) => ({
      ...d,
      phases: d.phases.map((p) =>
        p.id === ph.id ? { ...p, items: (p.items ?? []).filter((x) => x !== id) } : p,
      ),
    }))
  }, [])

  /* ---------------- accounts on and off the recorder ---------------- */

  /** Keep an account off the recorder's row without losing anything about it. */
  const toggleHideAcc = useCallback(
    (a: Account) => {
      const hiding = !a.hidden
      if (hiding && shownAccounts.length <= 1) return showToast('Keep one to record from.')
      setData((d) => ({
        ...d,
        accounts: d.accounts.map((x) => {
          if (x.id !== a.id) return x
          const { hidden: _dropped, ...rest } = x
          return hiding ? { ...rest, hidden: true } : rest
        }),
      }))
      if (hiding && acc === a.id) setAcc(null)
      showToast(hiding ? a.name + ' hidden from recording.' : a.name + ' is back.', 'ok')
    },
    [shownAccounts.length, acc, showToast],
  )

  /** The tour is done with, by Start or by Skip; it does not come back. */
  const finishTour = useCallback(() => {
    setData((d) => ({ ...d, settings: { ...d.settings, seenTour: true } }))
    setScreen('home')
    setBack('home')
  }, [])

  /**
   * Turning Pro on or off only flips a switch: the accounts and phases
   * already made are kept either way, so it can be tried and put back
   * without losing anything.
   */
  const setPro = useCallback(
    (on: boolean) => {
      setData((d) => ({ ...d, settings: { ...d.settings, pro: on } }))
      if (on) {
        setScreen('pro')
        setBack('profile')
      } else {
        showToast('Pro is off. Your accounts and phases are kept.', 'ok')
      }
    },
    [showToast],
  )

  /* ---------------- error screen ---------------- */

  const retry = useCallback(() => {
    // Nothing to retry while the Firebase keys are missing — the build
    // itself has to be fixed — so the screen stays put and says why.
    if (!isConfigured) return
    freeze('Trying again', FREEZE.retry, () => {
      setScreen(user ? 'home' : 'signin')
    })
  }, [freeze, user])

  /* ---------------- chip order ---------------- */

  const catFreq = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const i of data.items) if (i.note) freq[i.note] = (freq[i.note] || 0) + 1
    return freq
  }, [data.items])

  const orderedCats = useMemo(
    () => data.cats.slice().sort((a, b) => (catFreq[b] || 0) - (catFreq[a] || 0)),
    [data.cats, catFreq],
  )

  // The card shows one ultimate total, not a slice per currency: every
  // currency's money, plans and income are converted at the current rates
  // and added up, then expressed in whichever currency is being viewed.
  const balance = totalBalance(data.rates, data.balances, selCurs, activeCur)
  const plansOff = plansTake(data.rates, data.plans, activeCur)
  const safetyOff = safetyTake(data.rates, data.safety, activeCur)
  const incomeIn = countedIncome(data.rates, data.incomes, activeCur)
  const spend = balance - plansOff - safetyOff + incomeIn
  const shortfall = p1Shortfall(data.rates, balance, data.plans, activeCur)

  return {
    // state
    ready,
    user,
    data,
    screen,
    back,
    selCurs,
    mainCur,
    activeCur,
    balance,
    plansOff,
    safetyOff,
    incomeIn,
    spend,
    shortfall,
    amt,
    num,
    acc,
    note,
    fName,
    fEmail,
    fPass,
    fNew,
    fNew2,
    newCat,
    newCur,
    formError,
    errField,
    toast,
    confirm,
    busy,
    fBal,
    planForm,
    incomeForm,
    fSafety,
    extra,
    editId,
    eAmt,
    eNote,
    eDetail,
    eAcc,
    eDate,
    catFreq,
    orderedCats,
    canUsePhone,
    canUseCloud: isConfigured,
    sent,
    pro,
    accounts,
    shownAccounts,
    recCur,
    accForm,
    phaseForm,
    viewPhase,
    histPhase,
    selStart,
    selIds,
    selName,
    pickFor,
    picked,
    intoPhase,

    // setters
    setAmt,
    setAcc,
    setNote,
    setFName,
    setFEmail,
    setFPass,
    setFNew,
    setFNew2,
    setNewCat,
    setNewCur,
    setFBal,
    setPlanForm,
    setIncomeForm,
    setAccForm,
    setPhaseForm,
    setHistPhase,
    setSelName,
    setIntoPhase,
    setExtra,
    setEAmt,
    setENote,
    setEDetail,
    setEAcc,
    setEDate,
    setBalCur,
    setConfirm,
    clearErr,

    // helpers
    fmt,
    fmtIn,
    accName,
    accKind,
    shownRate,
    editRate,
    canRemoveCur,

    // actions
    go,
    goBack,
    goBalance,
    goPlans,
    goAccounts,
    openAccForm,
    saveAcc,
    addStandard,
    askRemoveAcc,
    goPhases,
    openPhase,
    openPhaseForm,
    savePhase,
    endPhase,
    askRemovePhase,
    startSelect,
    cancelSelect,
    tapRow,
    savePhaseFromSelection,
    startPick,
    savePick,
    unpickFrom,
    recordInto,
    toggleHideAcc,
    finishTour,
    goPro,
    setPro,
    openPlanForm,
    savePlan,
    askDeletePlan,
    openIncomeForm,
    saveIncome,
    askDeleteIncome,
    toggleCounted,
    editSafety,
    saveSafety,
    resetSafety,
    setSafetyCur,
    signUp,
    signIn,
    signInWithGoogle,
    askSignOut,
    unlockWithPhone,
    enablePhoneUnlock,
    disablePhoneUnlock,
    goForgot,
    sendReset,
    record,
    askDelete,
    openEditor,
    saveEdit,
    askClear,
    askDeleteAccount,
    saveBalance,
    openExtra,
    addCur,
    toggleCur,
    removeCur,
    addCat,
    removeCat,
    saveName,
    saveEmail,
    savePassword,
    setSetting,
    setMainCur,
    retry,
    showToast,
  }
}

export type App = ReturnType<typeof useApp>
