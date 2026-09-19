/**
 * Drives the built app against the REAL Firebase project — not the
 * emulators — and proves the things only the live system can: a person can
 * sign up, what they record reaches Firestore, it follows them to another
 * phone, and the published rules keep a stranger out. It signs up a
 * throwaway address and removes it again at the end, so the project is
 * left exactly as it was found.
 *
 * Needs `firebase login` done on this machine: the account's own token is
 * what reads the document back and cleans up afterwards.
 *
 *   npm run build && npx vite preview --port 4173
 *   APP_URL=http://localhost:4173/ node scripts/check-live.mjs
 */
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { chromium } from 'playwright'
import { gather } from './firebase-config.mjs'

const BASE = process.env.APP_URL || 'http://localhost:4173/'
const { projectId: PROJECT } = await gather()
if (!PROJECT) {
  console.log('\n  No Firebase config found — run npm run setup:firebase first.\n')
  process.exit(1)
}
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const ID = 'https://identitytoolkit.googleapis.com/v1'

/** The CLI's own login, which Firestore treats as the owner: rules do not
 *  apply to it, so it can read the document back and delete the account. */
const store = JSON.parse(
  await readFile(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'),
)
const OWNER = store?.tokens?.access_token
if (!OWNER) {
  console.log('\n  Not signed in to the Firebase CLI — run npx firebase-tools login.\n')
  process.exit(1)
}
const asOwner = (url, init = {}) =>
  fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${OWNER}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': PROJECT,
      ...(init.headers || {}),
    },
  })

let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures++
}

// A throwaway person, different every run.
const RUN = Date.now().toString(36)
const EMAIL = `byuma-check-${RUN}@example.com`
const PASS = `check-${RUN}-ubuzima`

// Where the machine reaches the internet through a proxy, the test browser
// has to be told so — Node picks HTTPS_PROXY up on its own, Chromium never
// does. Nothing local goes through it.
const proxy = process.env.HTTPS_PROXY
  ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' }
  : undefined

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  proxy,
  // An intercepting proxy and Chromium's HTTP/2 do not get on: one request
  // in three dies with ERR_TOO_MANY_RETRIES. Plain HTTP/1.1 always arrives.
  args: process.env.TRUST_PROXY_CA === '1' ? ['--disable-http2', '--disable-quic'] : [],
})

// A slow road to Google — a sandbox, a bad connection — should not read as
// a broken app, so the waits here are generous.
const SLOW = 60000
const SETTLE = 6000

/** A fresh browser context is a fresh phone: no storage, no session.
 *
 *  Some sandboxes route the browser through a proxy that re-signs TLS with
 *  its own certificate; Node is told to trust it, Chromium is not, and every
 *  call to Firebase dies with ERR_CERT_AUTHORITY_INVALID. TRUST_PROXY_CA=1
 *  lets this throwaway test browser — nothing else — accept it. */
async function phone() {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: process.env.TRUST_PROXY_CA === '1',
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => {
    console.log('  ! page error:', e.message)
    failures++
  })
  return { ctx, page }
}

async function record(page, amount, method, note) {
  await page.click('.amount-display')
  await page.fill('input[aria-label="Amount"]', amount)
  await page.click(`.method-btn >> text=${method}`)
  if (note) await page.click(`.chip >> text=${note}`)
  await page.click('.cta')
  await page.waitForTimeout(200)
}

/** The total sits behind a tap. Open it only if it is currently covered. */
async function reveal(page) {
  if ((await page.locator('.spent-figure').count()) === 0) {
    await page.click('.spent-card')
    await page.waitForSelector('.spent-figure')
  }
  return (await page.textContent('.spent-figure')).trim()
}

/** Whatever happens above, the throwaway person is removed. */
let uid = ''
async function cleanUp() {
  if (!uid) {
    const look = await asOwner(`${ID}/projects/${PROJECT}/accounts:lookup`, {
      method: 'POST',
      body: JSON.stringify({ email: [EMAIL] }),
    })
    uid = (await look.json().catch(() => ({}))).users?.[0]?.localId || ''
  }
  if (!uid) return 'nothing to remove'
  const doc = await asOwner(`${FS}/users/${uid}`, { method: 'DELETE' })
  const acc = await asOwner(`${ID}/projects/${PROJECT}/accounts:delete`, {
    method: 'POST',
    body: JSON.stringify({ localId: uid }),
  })
  return `document ${doc.ok ? 'removed' : 'HTTP ' + doc.status}, account ${acc.ok ? 'removed' : 'HTTP ' + acc.status}`
}

try {
  console.log(`\nLive check against ${PROJECT} as ${EMAIL}`)

  console.log('\n1. Sign up, record, and reach Firestore')
  const alice = await phone()
  await alice.page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await alice.page.waitForSelector('text=Track what you spend.', { timeout: 20000 })
  check('the app opens, connected', (await alice.page.locator('text=Not connected yet').count()) === 0)
  await alice.page.fill('input[placeholder="Name"]', 'Check')
  await alice.page.fill('input[placeholder="Email"]', EMAIL)
  await alice.page.fill('input[placeholder="Password"]', PASS)
  await alice.page.click('text=Create account')
  await alice.page.waitForSelector('.tour-slide', { timeout: SLOW })
  check('a new account lands in the tour', true)
  await alice.page.click('text=Skip')
  await alice.page.waitForSelector('.amount-display', { timeout: 10000 })
  await record(alice.page, '2400', 'Bank', 'Groceries')
  await record(alice.page, '12500', 'Bank')
  // The save is debounced; give it room to cross the internet.
  await alice.page.waitForTimeout(SETTLE)

  const look = await asOwner(`${ID}/projects/${PROJECT}/accounts:lookup`, {
    method: 'POST',
    body: JSON.stringify({ email: [EMAIL] }),
  })
  uid = (await look.json()).users?.[0]?.localId || ''
  check('Firebase Auth knows the account', !!uid, uid ? uid.slice(0, 8) + '…' : 'not found')

  const stored = await (await asOwner(`${FS}/users/${uid}`)).json()
  check('its users/{uid} document exists', !!stored.fields, stored.error?.message || '')
  const items = stored.fields?.items?.arrayValue?.values ?? []
  check('both expenses are in it', items.length === 2, `${items.length} found`)
  const amounts = items
    .map((v) => Number(v.mapValue.fields.amount.doubleValue ?? v.mapValue.fields.amount.integerValue))
    .sort((a, b) => a - b)
  check('the amounts are right', JSON.stringify(amounts) === '[2400,12500]', amounts.join(', '))

  console.log('\n2. The same account on a different phone')
  const bob = await phone()
  await bob.page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await bob.page.waitForSelector('text=Track what you spend.', { timeout: 20000 })
  await bob.page.click('text=Sign in')
  await bob.page.waitForSelector('text=Welcome back.')
  await bob.page.fill('input[placeholder="Email"]', EMAIL)
  await bob.page.fill('input[placeholder="Password"]', PASS)
  await bob.page.click('.btn-primary >> text=Sign in')
  await bob.page.waitForSelector('.spent-card', { timeout: SLOW })
  const spent = await reveal(bob.page)
  check('the expenses followed the account', spent.includes('14,900'), spent)

  console.log('\n3. An expense made on the second phone reaches the first')
  await record(bob.page, '600', 'Cash')
  await bob.page.waitForTimeout(SETTLE)
  await alice.page.reload({ waitUntil: 'domcontentloaded' })
  await alice.page.waitForSelector('.spent-card', { timeout: SLOW })
  const back = await reveal(alice.page)
  check('the first phone sees it after a reload', back.includes('15,500'), back)

  console.log('\n4. The published rules keep a stranger out')
  const open = await fetch(`${FS}/users/${uid}`)
  check('an unauthenticated read is refused', open.status === 403 || open.status === 401, 'HTTP ' + open.status)
} catch (e) {
  failures++
  console.log('  ✗ stopped:', e.message.split('\n')[0])
} finally {
  await browser.close()
  console.log('\n5. Leaving the project as it was found')
  console.log('  ' + (await cleanUp()))
}

console.log(failures ? `\n${failures} problem(s).\n` : '\nEverything checked out, live.\n')
process.exit(failures ? 1 : 0)
