/**
 * Drives the real app against the Firebase emulators and checks the things
 * that only a running system can answer: does an account get made, does an
 * expense reach Firestore, does it come back on another "phone", does the
 * old phone-only data get carried up, and do the rules keep one account out
 * of another's document.
 *
 *   firebase emulators:start --only auth,firestore
 *   node e2e-cloud.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.APP_URL || 'http://localhost:4173/Byuma-FT-Lite/'
const PROJECT = 'demo-byuma'
const REST = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`

let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures++
}

// Start from nothing, so the run says the same thing every time.
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, {
  method: 'DELETE',
})
await fetch(
  `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
  { method: 'DELETE' },
)

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

/** A fresh browser context is a fresh phone: no storage, no session. */
async function phone() {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => {
    console.log('  ! page error:', e.message)
    failures++
  })
  return { ctx, page }
}

async function signUp(page, name, email, pass) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Track what you spend.')
  await page.click('text=Use email instead')
await page.fill('input[placeholder="Name"]', name)
  await page.fill('input[placeholder="Email"]', email)
  await page.fill('input[placeholder="Password"]', pass)
  await page.click('text=Create account')
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

console.log('\n1. Sign up, record, and reach Firestore')
const alice = await phone()
await signUp(alice.page, 'Thierry', 'thierry@example.com', 'ubuzima2026')
await alice.page.waitForSelector('.tour-slide', { timeout: 15000 })
check('a new account lands in the tour', true)
await alice.page.click('text=Skip')
await alice.page.waitForSelector('.amount-display', { timeout: 10000 })
await record(alice.page, '2400', 'Bank', 'Groceries')
await record(alice.page, '12500', 'Bank')
// The save is debounced; give it room to land.
await alice.page.waitForTimeout(2000)

const docs = await (
  await fetch(`${REST}/users`, { headers: { Authorization: 'Bearer owner' } })
).json()
const stored = docs.documents?.[0]
check('a users/{uid} document exists', !!stored, stored ? stored.name.split('/').pop() : 'none')
const items = stored?.fields?.items?.arrayValue?.values ?? []
check('both expenses are in it', items.length === 2, `${items.length} found`)
const amounts = items
  .map((v) => Number(v.mapValue.fields.amount.doubleValue ?? v.mapValue.fields.amount.integerValue))
  .sort((a, b) => a - b)
check('the amounts are right', JSON.stringify(amounts) === '[2400,12500]', amounts.join(', '))

console.log('\n2. The same account on a different phone')
const bob = await phone()
await bob.page.goto(BASE, { waitUntil: 'domcontentloaded' })
await bob.page.waitForSelector('text=Track what you spend.')
await bob.page.click('text=Sign in')
await bob.page.waitForSelector('text=Welcome back.')
await bob.page.click('text=Use email instead')
await bob.page.fill('input[placeholder="Email"]', 'thierry@example.com')
await bob.page.fill('input[placeholder="Password"]', 'ubuzima2026')
await bob.page.click('.btn-primary >> text=Sign in')
await bob.page.waitForSelector('.spent-card', { timeout: 15000 })
const spent = await reveal(bob.page)
check('the expenses followed the account', spent.includes('14,900'), spent.trim())

console.log('\n3. An expense made on the second phone reaches the first')
await record(bob.page, '600', 'Cash')
await bob.page.waitForTimeout(2000)
await alice.page.reload({ waitUntil: 'domcontentloaded' })
await alice.page.waitForSelector('.spent-card', { timeout: 15000 })
const back = await reveal(alice.page)
check('the first phone sees it after a reload', back.includes('15,500'), back.trim())

console.log('\n4. Data from the phone-only version is carried up')
const old = await phone()
await old.page.goto(BASE, { waitUntil: 'domcontentloaded' })
// Plant exactly what an older build of the app would have left behind.
await old.page.evaluate(() => {
  localStorage.setItem(
    'byuma.accounts.v1',
    JSON.stringify([
      {
        id: 'legacy-1',
        name: 'Old',
        email: 'old@example.com',
        salt: 'x',
        hash: 'y',
        iterations: 210000,
        createdAt: Date.now(),
      },
    ]),
  )
  localStorage.setItem(
    'byuma.data.v1.legacy-1',
    JSON.stringify({
      items: [
        { id: 'a', amount: 7700, method: 'cash', note: 'Rent', cur: 'RWF', at: Date.now() },
      ],
      balances: { RWF: 500000 },
      selCurs: ['RWF'],
      mainCur: 'RWF',
    }),
  )
})
await signUp(old.page, 'Old', 'old@example.com', 'ubuzima2026')
// Someone with expenses already recorded is not new to the app, so the
// tour stays out of their way and they land straight on the money.
await old.page.waitForSelector('.amount-display', { timeout: 15000 })
check('a carried-up save skips the tour', (await old.page.locator('.tour-slide').count()) === 0)
const carried = await reveal(old.page)
check('the old expense survived the move', carried.includes('7,700'), carried.trim())
const cleaned = await old.page.evaluate(() => localStorage.getItem('byuma.accounts.v1'))
check('the phone-only copy was cleared afterwards', cleaned === null)

console.log('\n5. A check-up measures what moved unrecorded')
// Bob has recorded 2,400 + 12,500 (alice, same account) + 600 = 15,500 in
// RWF since the account began. A first check-up of 840,000 becomes the
// balance; the second, 800,000 after a further 900 recorded, is 39,100
// short of what the records expect.
await bob.page.click('.tab >> text="Analytics"')
await bob.page.waitForSelector('text=Update balance', { timeout: 10000 })
await bob.page.click('.card-footer-btn >> text=Update balance')
await bob.page.waitForSelector('input[aria-label="Cash RWF total"]', { timeout: 10000 })
await bob.page.fill('input[aria-label="Cash RWF total"]', '840000')
await bob.page.click('.btn-save')
await bob.page.waitForSelector('text=Where the money went', { timeout: 10000 })
await bob.page.waitForTimeout(1500)
const afterFirst = (await bob.page.textContent('.card-balance')).replace(/\s+/g, ' ')
check('the first check-up becomes the balance', /840,000/.test(afterFirst), afterFirst.slice(0, 60))

await bob.page.click('.tab >> text="Home"')
await bob.page.waitForSelector('.amount-display')
await record(bob.page, '900', 'Cash')
await bob.page.click('.tab >> text="Analytics"')
await bob.page.waitForSelector('text=Update balance', { timeout: 10000 })
const running = (await bob.page.textContent('.card-balance')).replace(/\s+/g, ' ')
check('spending since comes off it', /839,100/.test(running), running.slice(0, 60))

await bob.page.click('.card-footer-btn >> text=Update balance')
await bob.page.waitForSelector('input[aria-label="Cash RWF total"]', { timeout: 10000 })
await bob.page.fill('input[aria-label="Cash RWF total"]', '800000')
await bob.page.click('.btn-save')
await bob.page.waitForSelector('text=Check-ups', { timeout: 10000 })
const checkupText = (await bob.page.textContent('.checkup-row')).replace(/\s+/g, ' ')
check('the second check-up keeps the unrecorded difference', /39,100/.test(checkupText), checkupText)
await bob.page.waitForTimeout(1500)
const cuDoc = await (await fetch(`${REST}/users`, { headers: { Authorization: 'Bearer owner' } })).json()
const cuDiffs = (cuDoc.documents ?? [])
  .flatMap((d) => d.fields?.checkups?.arrayValue?.values ?? [])
  .map((v) => v.mapValue.fields.diff?.mapValue?.fields?.RWF)
  .map((f) => Number(f?.integerValue ?? f?.doubleValue))
check('and it reached Firestore', cuDiffs.includes(-39100), cuDiffs.join(', '))

console.log('\n6. Accounts for the balance, a started phase, income received, a way of paying hidden')
// An account named on the Balance screen holds part of the balance.
await bob.page.click('.card-footer-btn >> text=Update balance')
await bob.page.waitForSelector('.acc-area', { timeout: 10000 })
await bob.page.click('.pick-chip >> text=Add an account')
await bob.page.fill('input[placeholder="What is it? Ziraat, Albaraka…"]', 'Ziraat')
await bob.page.click('text=Add account')
await bob.page.waitForSelector('input[aria-label="Ziraat RWF total"]', { timeout: 5000 })
check('a named account gets its own balance rows', true)
await bob.page.fill('input[aria-label="Ziraat RWF total"]', '100000')
await bob.page.click('.btn-save')
await bob.page.waitForSelector('text=Where the money is', { timeout: 10000 })
const where = (await bob.page.textContent('.card-list')).replace(/\s+/g, ' ')
check('Analytics shows where the money is', /Ziraat/.test(where) && /100,000/.test(where), where.slice(0, 80))

// A phase started from History takes what is recorded from now on.
await bob.page.click('.tab >> text="History"')
await bob.page.waitForSelector('.phase-strip', { timeout: 10000 })
await bob.page.click('.phase-chip-add')
await bob.page.fill('.sel-name', 'Trip')
await bob.page.click('.sel-save')
await bob.page.waitForSelector('.phase-card', { timeout: 5000 })
check('a phase can be started from History', /Trip/.test(await bob.page.textContent('.phase-card')))
await bob.page.click('.tab >> text="Home"')
await bob.page.waitForSelector('.amount-display')
await record(bob.page, '5000', 'Bank')
await bob.page.click('.tab >> text="History"')
await bob.page.waitForSelector('.phase-strip', { timeout: 10000 })
// History still has Trip open from when it was started; tapping its chip
// again would close it.
if ((await bob.page.locator('.phase-card').count()) === 0) await bob.page.click('.phase-chip >> text=Trip')
await bob.page.waitForSelector('.phase-card', { timeout: 5000 })
const tripCard = (await bob.page.textContent('.phase-card')).replace(/\s+/g, ' ')
// A phase starts on a day, not at a moment: one begun today holds everything
// recorded today — the 2,400 + 12,500 + 600 + 900 from before and this 5,000.
check(
  'what is recorded while it runs falls into it',
  /21,400/.test(tripCard) && /5 expenses/.test(tripCard),
  tripCard.slice(0, 60),
)
// Out of the totals: Spent this month drops it, the graph keeps it. Every
// expense this month is in the phase, so the Home card has nothing to show.
await bob.page.click('.phase-card-btn >> text=Details')
await bob.page.waitForSelector('[aria-label="Count in totals"]', { timeout: 5000 })
await bob.page.click('[aria-label="Count in totals"]')
await bob.page.click('button[aria-label="Back"]')
await bob.page.waitForSelector('.phase-strip', { timeout: 10000 })
await bob.page.click('.tab >> text="Home"')
await bob.page.waitForSelector('.amount-display', { timeout: 10000 })
await bob.page.waitForTimeout(300)
check(
  'a phase left out of totals is not in Spent this month',
  (await bob.page.locator('.spent-card').count()) === 0,
)
// The day strip draws everything, so today's bar still carries the 21,400.
await bob.page.click('.tab >> text="Analytics"')
await bob.page.waitForSelector('.bar-col[aria-pressed="true"]', { timeout: 10000 })
const todayBar = (await bob.page.textContent('.bar-col[aria-pressed="true"]')).replace(/\s+/g, ' ')
check('but the graph still draws it', /21,400/.test(todayBar), todayBar)
const monthCard = (await bob.page.textContent('.card-month')).replace(/\s+/g, ' ')
check('while Spent this month leaves it out', /RWF 0$/.test(monthCard), monthCard)

// Expected income: Received puts it in the balance.
await bob.page.click('.tab >> text="Analytics"')
await bob.page.waitForSelector('text=Update balance', { timeout: 10000 })
await bob.page.click('.card-footer-btn >> text=Plans')
await bob.page.waitForSelector('text=Expected income', { timeout: 10000 })
await bob.page.click('text=＋ Add income')
await bob.page.fill('input[placeholder="Where from? Salary, a client…"]', 'Salary')
await bob.page.fill('.mini-form input[aria-label="Amount"]', '50000')
await bob.page.click('text=Add income')
await bob.page.waitForSelector('button[aria-label="Received Salary"]', { timeout: 5000 })
await bob.page.click('button[aria-label="Received Salary"]')
await bob.page.waitForSelector('text=received', { timeout: 5000 })
await bob.page.click('button[aria-label="Back"]')
await bob.page.waitForSelector('text=Where the money went', { timeout: 10000 })
const withIncome = (await bob.page.textContent('.card-balance')).replace(/\s+/g, ' ')
check('received income is in the balance', /945,000/.test(withIncome), withIncome.slice(0, 60))

// A way of paying kept off the recorder.
await bob.page.click('.tab >> text="Account"')
await bob.page.waitForSelector('text=Ways of paying', { timeout: 10000 })
await bob.page.click('button[aria-label="Hide MoMo"]')
await bob.page.click('.tab >> text="Home"')
await bob.page.waitForSelector('.amount-display')
check('a hidden way of paying leaves the recorder', (await bob.page.locator('.method-btn >> text=MoMo').count()) === 0)
check('the others stay', (await bob.page.locator('.method-btn').count()) === 2)

console.log('\n7. The rules keep one account out of another')
const uid = stored?.name.split('/').pop()
const open = await fetch(`${REST}/users/${uid}`)
check('an unauthenticated read is refused', open.status === 403 || open.status === 401,
  'HTTP ' + open.status)

await browser.close()
console.log(failures ? `\n${failures} problem(s).\n` : '\nEverything checked out.\n')
process.exit(failures ? 1 : 0)
