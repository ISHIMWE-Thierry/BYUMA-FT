import type { Due } from './calc'
import { fmt } from './money'

/**
 * Reminders: a note on the phone two days before, and on the day, a plan
 * or an expected income is due.
 *
 * There is no server to send them, so two things do the work. While the
 * app is open — or brought back to the front — the page itself checks and
 * shows what is due. For the times the app is closed, the service worker
 * keeps a copy of what is coming up (handed to it here, in IndexedDB) and
 * checks it whenever the phone lets it run: on periodic background sync
 * where that exists, and on every message the page sends it.
 *
 * Each due thing is shown once per day it is due, and never twice for the
 * same day: the page and the worker both leave the same mark.
 */

const DB = 'byuma'
const STORE = 'reminders'
const KEY = 'due'
const SHOWN = 'byuma.reminded.v1'

/** Is this browser able to show notifications at all? */
export function canRemind(): boolean {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator
}

export function remindGranted(): boolean {
  return canRemind() && Notification.permission === 'granted'
}

/** Ask, once; the browser remembers the answer. */
export async function askToRemind(): Promise<boolean> {
  if (!canRemind()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

/** What a reminder says. */
export function wording(d: Due): { title: string; body: string } {
  const when = d.daysLeft === 0 ? 'today' : d.daysLeft === 1 ? 'tomorrow' : 'in 2 days'
  const amount = fmt(d.amt, d.cur)
  return d.kind === 'plan'
    ? { title: d.name + ' — ' + when, body: amount + ' set aside for it.' }
    : { title: d.name + ' — ' + when, body: amount + ' expected. Tap Received when it lands.' }
}

/* ---------------- the copy the worker reads ---------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Hand the worker what is coming up, so it can remind with the app closed. */
export async function handToWorker(due: Due[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(due, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // No IndexedDB (private mode): the page still reminds while it is open.
  }
}

/* ---------------- showing them ---------------- */

/** "key|date|daysLeft" marks, so each note is shown once. */
function shownSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHOWN) || '[]') as string[])
  } catch {
    return new Set()
  }
}

function markShown(set: Set<string>) {
  try {
    // Keep it small: only the last hundred marks matter.
    localStorage.setItem(SHOWN, JSON.stringify([...set].slice(-100)))
  } catch {
    /* ignore */
  }
}

/** Show what is due and has not been shown for that day yet. */
export async function remindNow(due: Due[]): Promise<number> {
  if (!remindGranted()) return 0
  const seen = shownSet()
  let shown = 0
  for (const d of due) {
    const mark = d.key + '|' + d.date + '|' + d.daysLeft
    if (seen.has(mark)) continue
    const { title, body } = wording(d)
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, { body, tag: mark, icon: 'icons/icon-192.png' })
    } catch {
      try {
        new Notification(title, { body, tag: mark })
      } catch {
        continue
      }
    }
    seen.add(mark)
    shown++
  }
  if (shown) markShown(seen)
  return shown
}

/**
 * Ask the phone to wake the worker now and then. Only installed apps on
 * Android get this, and only once the phone trusts them; everywhere else
 * the page's own checks carry the reminders.
 */
export async function askPeriodicChecks(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sync = (reg as ServiceWorkerRegistration & {
      periodicSync?: { register(tag: string, opts: { minInterval: number }): Promise<void> }
    }).periodicSync
    if (!sync) return
    await sync.register('byuma-reminders', { minInterval: 12 * 60 * 60 * 1000 })
  } catch {
    // Not allowed here; nothing lost.
  }
}

/** Nudge the worker to look now, for phones without periodic sync. */
export function nudgeWorker(): void {
  navigator.serviceWorker?.controller?.postMessage({ type: 'byuma:check-reminders' })
}
