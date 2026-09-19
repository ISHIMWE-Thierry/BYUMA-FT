/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

/**
 * The service worker. Two jobs:
 *
 *   1. Serve the saved copy of the app instantly, and swap in a new version
 *      the moment one is downloaded — what the plugin's autoUpdate did.
 *   2. Remind, with the app closed: whenever the phone wakes it (periodic
 *      background sync where that exists, or a nudge from the page), read
 *      what the page left in IndexedDB and show whatever is due today.
 */

// ---- the app itself ------------------------------------------------------

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// A single-page app: every navigation gets index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// A new version takes over straight away, and the page reloads onto it.
self.skipWaiting()
clientsClaim()

// ---- reminders -------------------------------------------------------------

const DB = 'byuma'
const STORE = 'reminders'
const KEY = 'due'
const SHOWN = 'shown'

interface Due {
  key: string
  kind: 'plan' | 'income'
  name: string
  amt: number
  cur: string
  date: string
  daysLeft: number
}

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

function get<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

function put(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** yyyy-mm-dd, in the phone's own timezone. */
function dayKey(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function money(amt: number, cur: string): string {
  return cur + ' ' + Math.round(amt).toLocaleString('en-US')
}

/**
 * The page wrote the list when it last ran, with each thing's days-left as
 * of then; the days that have passed since are taken off here, so a note
 * written for "in 2 days" still reads "today" on the day.
 */
async function remind(): Promise<void> {
  if (Notification.permission !== 'granted') return
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return
  }
  const due = (await get<Due[]>(db, KEY)) ?? []
  const shown = new Set((await get<string[]>(db, SHOWN)) ?? [])
  const today = dayKey(Date.now())
  let changed = false
  for (const d of due) {
    if (d.date < today) continue
    const left = Math.round(
      (new Date(d.date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 864e5,
    )
    if (left > 2) continue
    const mark = d.key + '|' + d.date + '|' + left
    if (shown.has(mark)) continue
    const when = left === 0 ? 'today' : left === 1 ? 'tomorrow' : 'in 2 days'
    const body =
      d.kind === 'plan'
        ? money(d.amt, d.cur) + ' set aside for it.'
        : money(d.amt, d.cur) + ' expected. Tap Received when it lands.'
    await self.registration.showNotification(d.name + ' — ' + when, {
      body,
      tag: mark,
      icon: 'icons/icon-192.png',
    })
    shown.add(mark)
    changed = true
  }
  if (changed) await put(db, SHOWN, [...shown].slice(-100))
  db.close()
}

self.addEventListener('periodicsync', (event) => {
  const e = event as ExtendableEvent & { tag: string }
  if (e.tag === 'byuma-reminders') e.waitUntil(remind())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'byuma:check-reminders') event.waitUntil(remind())
})

// Tapping a note opens the app, or brings it to the front.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c)
      if (open) return open.focus()
      return self.clients.openWindow('./')
    }),
  )
})
