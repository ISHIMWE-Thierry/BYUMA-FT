import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Account,
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
} from './lib/calc'
import { passkeyAvailable, registerPasskey, verifyPasskey } from './lib/passkey'
import {
  clearLegacyFor,
  clearPasskeyId,
  freshData,
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
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type User,
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
    default:
      return 'That did not work. Try again.'
  }
}

/** The Firebase user as the app holds it, plus this phone's passkey. */
function accountFrom(user: User): Account {
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

/** Screens the phone's back button leaves the app from, not walks back from. */
const ROOTS: Screen[] = ['home', 'signin', 'signup', 'error']

export function useApp() {
  const [account, setAccount] = useState<Account | null>(null)
  const [data, setData] = useState<UserData>(freshData)
  const [ready, setReady] = useState(false)

  const [screen, setScreen] = useState<Screen>('signup')
  const [back, setBack] = useState<Screen>('home')

  // recorder
  const [amt, setAmt] = useState('')
  const [method, setMethod] = useState<Method | null>(null)
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
  const [eMethod, setEMethod] = useState<Method>('cash')
  // The editor can move an expense to another day; recording always stamps
  // the moment it happened.
  const [eDate, setEDate] = useState(today())

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

  // Set while a sign-up is in flight, so the person who has just made an
  // account lands in the tour rather than on the home screen.
  const fresh = useRef(false)
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
  const openFor = useCallback(async (user: User) => {
    const acc = accountFrom(user)
    let d: UserData
    let carried = false
    try {
      const cloud = await loadCloud(user.uid)
      if (cloud) {
        d = cloud
      } else {
        // Nothing saved under this account yet. If this phone still holds
        // what an older, phone-only version recorded for the same email,
        // that history becomes the account's opening data.
        const legacy = localDataFor(acc.email)
        d = legacy ?? freshData()
        await saveCloud(user.uid, d)
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
    setAccount(acc)
    setData(d)
    setBalCur(d.selCurs.includes(d.mainCur) ? d.mainCur : d.selCurs[0])
    // A passkey enrolled on this phone turns it into a lock on the app
    // itself: Firebase keeps the session, so the fingerprint is what stands
    // between someone holding the phone and the money on it.
    setScreen(fresh.current ? 'tour' : acc.passkeyId ? 'lock' : 'home')
    setBack('home')
    fresh.current = false
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
    return onAuthStateChanged(auth, (user) => {
      if (user) void openFor(user)
      else {
        setAccount(null)
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
    if (!ready || !account) return
    if (justLoaded.current) {
      justLoaded.current = false
      return
    }
    dirty.current = true
    const t = window.setTimeout(() => {
      void saveCloud(account.id, data)
        .then(() => {
          dirty.current = false
        })
        .catch(() => {
          // Firestore keeps the write and retries; nothing to do here but
          // leave the flag up so a pull cannot overwrite it meanwhile.
        })
    }, 700)
    return () => window.clearTimeout(t)
  }, [ready, account, data])

  // Coming back to the app is when another phone's work should appear. Only
  // when nothing local is waiting to be written, so a pull never wins over
  // an edit that has not gone up yet.
  useEffect(() => {
    if (!ready || !account) return
    const onShow = () => {
      if (document.visibilityState !== 'visible' || dirty.current) return
      void loadCloud(account.id)
        .then((cloud) => {
          if (!cloud || dirty.current) return
          justLoaded.current = true
          setData(cloud)
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [ready, account])

  /* ---------------- live rates ---------------- */

  useEffect(() => {
    if (!ready || !account) return
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
  }, [ready, account?.id])

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
      !ROOTS.includes(screen) || !!confirm || !!editId || !!planForm || !!incomeForm
    if (needsGuard && !armed.current) {
      history.pushState({ byuma: true }, '')
      armed.current = true
    }
  }, [ready, screen, confirm, editId, planForm, incomeForm])

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
      // Seen by the boot listener, which sends a new person to the tour.
      fresh.current = true
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
    if (!account?.passkeyId) return
    const ok = await verifyPasskey(account.passkeyId)
    if (!ok) return fail('pass', 'That did not match. Try again.')
    freeze('Opening', FREEZE.unlock, () => {
      setScreen('home')
      setBack('home')
      clearErr()
    })
  }, [account, fail, freeze, clearErr])

  /** Ask the phone to guard this account, from Profile. */
  const enablePhoneUnlock = useCallback(async () => {
    if (!account) return
    const id = await registerPasskey(account.id, account.email, account.name)
    if (!id) return showToast('Your phone did not confirm it.')
    savePasskeyId(account.id, id)
    setAccount({ ...account, passkeyId: id })
    showToast('Phone lock is on.', 'ok')
  }, [account, showToast])

  const disablePhoneUnlock = useCallback(() => {
    if (!account) return
    setConfirm({
      title: 'Turn off phone lock?',
      body: 'The app will open without asking for your fingerprint.',
      cta: 'Turn off',
      yes: () => {
        clearPasskeyId(account.id)
        setAccount({ ...account, passkeyId: undefined })
        showToast('Phone lock is off.', 'ok')
      },
    })
  }, [account, showToast])

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
    if (!method) return showToast('Pick cash, MoMo or bank first.')
    const item: Expense = {
      id: newId(),
      amount: num,
      method,
      note: note.trim(),
      cur: mainCur,
      at: Date.now(),
    }
    setData((d) => ({
      ...d,
      items: [item, ...d.items],
      // Recording spends the money, so the total comes down by itself.
      balances: applyRecord(d.balances, item),
      // A note typed by hand becomes a category, ready as a chip next time.
      cats: rememberCategory(d.cats, item.note),
      cleared: false,
    }))
    setAmt('')
    setNote('')
    setMethod(null)
    showToast('Recorded ' + fmt(num) + '.', 'ok')
  }, [num, method, note, mainCur, fmt, showToast])

  const askDelete = useCallback(
    (item: Expense) => {
      setEditId(null)
      setConfirm({
        title: 'Delete this expense?',
        body:
          fmtIn(item.amount, item.cur) +
          ' · ' +
          (item.note || { cash: 'Cash', momo: 'MoMo', bank: 'Bank' }[item.method]),
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
      setEMethod(item.method)
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
                method: eMethod,
                at: atOn(eDate, item.at),
              }
            : x,
        ),
        // Move the balance by the difference only.
        balances: applyEdit(d.balances, item, v),
        cats: rememberCategory(d.cats, eNote),
      }))
      setEditId(null)
      showToast('Expense updated.', 'ok')
    },
    [eAmt, eNote, eDetail, eMethod, eDate, showToast],
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
      for (const c of selCurs) next[c] = data.balances[c] ? String(data.balances[c]) : ''
      setFBal(next)
      setExtra(null)
      clearErr()
      setScreen('balance')
      setBack(from)
    },
    [selCurs, data.balances, clearErr],
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
    const vals: Record<string, number> = { ...data.balances }
    for (const c of selCurs) {
      const raw = (fBal[c] ?? '').trim()
      if (raw && isNaN(Number(raw))) return fail('bal' + c, 'That is not a number.')
      vals[c] = Number(raw) || 0
    }
    let added = 0
    if (extra && extra.amt) {
      const a = Number(extra.amt) || 0
      const r = Number(extra.rate) || 0
      if (a > 0 && r <= 0) return fail('exrate', 'Set a rate first.')
      added = a * r
    }
    if (!selCurs.some((c) => vals[c] > 0) && added <= 0) {
      return fail('bal' + selCurs[0], 'Enter at least one total.')
    }
    if (added > 0) vals[mainCur] = (vals[mainCur] ?? 0) + added

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
  }, [data.balances, selCurs, fBal, extra, mainCur, fail, freeze, showToast, fmtIn])

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
      setAccount((a) => (a ? { ...a, name: next } : a))
      setScreen('profile')
      resetForms()
      showToast('Name changed.', 'ok')
    })
  }, [fName, fail, freeze, resetForms, showToast])

  /** Prove it is really them before a change that touches the account. */
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
   * Firebase sends a link to the new address first, and the account moves
   * over only when that link is opened. That is what stops someone typing
   * an address they cannot read and locking themselves out.
   */
  const saveEmail = useCallback(async () => {
    const user = auth?.currentUser
    if (!account || !user) return
    if (!emailOk(fEmail)) return fail('email', 'That email does not look right.')
    if (fEmail.trim().toLowerCase() === account.email.toLowerCase()) {
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
            await verifyBeforeUpdateEmail(user, next)
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
  }, [account, fEmail, fPass, fail, reauth, resetForms, showToast])

  const savePassword = useCallback(async () => {
    const user = auth?.currentUser
    if (!account || !user) return
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
            await updatePassword(user, next)
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
  }, [account, fPass, fNew, fNew2, fail, reauth, resetForms, showToast])

  /**
   * The whole account, gone: the saved data, then the Firebase account
   * itself. Said plainly before anything happens, and it now means every
   * phone rather than only this one.
   */
  const askDeleteAccount = useCallback(() => {
    if (!account) return
    setConfirm({
      title: 'Delete your account?',
      body:
        'Your account and everything saved under ' +
        account.email +
        ' are deleted, on every phone. This cannot be undone.',
      cta: 'Delete account',
      danger: true,
      yes: () => {
        void (async () => {
          setBusy('Deleting account')
          const user = auth?.currentUser
          if (!user) return setBusy(null)
          try {
            await deleteCloud(user.uid)
            clearPasskeyId(user.uid)
            clearLegacyFor(account.email)
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
  }, [account, resetForms, showToast])

  const setSetting = useCallback((key: keyof Settings) => {
    setData((d) => ({ ...d, settings: { ...d.settings, [key]: !d.settings[key] } }))
  }, [])

  const setMainCur = useCallback((code: string) => {
    setData((d) => ({ ...d, mainCur: code }))
    setBalCur(code)
  }, [])

  /* ---------------- error screen ---------------- */

  const retry = useCallback(() => {
    // Nothing to retry while the Firebase keys are missing — the build
    // itself has to be fixed — so the screen stays put and says why.
    if (!isConfigured) return
    freeze('Trying again', FREEZE.retry, () => {
      setScreen(account ? 'home' : 'signin')
    })
  }, [freeze, account])

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
    account,
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
    method,
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
    eMethod,
    eDate,
    catFreq,
    orderedCats,
    canUsePhone,
    canUseCloud: isConfigured,
    sent,

    // setters
    setAmt,
    setMethod,
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
    setExtra,
    setEAmt,
    setENote,
    setEDetail,
    setEMethod,
    setEDate,
    setBalCur,
    setConfirm,
    clearErr,

    // helpers
    fmt,
    fmtIn,
    shownRate,
    editRate,
    canRemoveCur,

    // actions
    go,
    goBack,
    goBalance,
    goPlans,
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
