/**
 * Drives the built app on every phone we target and checks that nothing
 * overflows sideways. Writes a screenshot per screen per device.
 *
 *   npm run build && node scripts/check-layout.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.APP_URL || 'http://localhost:4173'
const OUT = process.env.SHOT_DIR || 'shots'

// Accounts are real and shared now, so each run signs up as somebody new
// rather than colliding with the last run's people.
const RUN = Date.now().toString(36)

const DEVICES = [
  { name: 'tecno-spark-7t', width: 360, height: 800, dpr: 2 },
  { name: 'iphone-14-pro', width: 393, height: 852, dpr: 3 },
  { name: 'iphone-15-pro', width: 393, height: 852, dpr: 3 },
  { name: 'iphone-17-pro-max', width: 440, height: 956, dpr: 3 },
]

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

let failures = 0

/** Anything wider than the phone, or any text spilling out of its box. */
async function checkOverflow(page, device, screen) {
  const problems = await page.evaluate((deviceWidth) => {
    const out = []
    const doc = document.documentElement
    if (doc.scrollWidth > deviceWidth + 1) {
      out.push(`page scrolls sideways: ${doc.scrollWidth}px > ${deviceWidth}px`)
    }
    for (const el of document.querySelectorAll('.phone *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right > deviceWidth + 1 || r.left < -1) {
        // A sideways scroller is allowed to hold wider content.
        let p = el.parentElement
        let inScroller = false
        while (p) {
          if (getComputedStyle(p).overflowX === 'auto') {
            inScroller = true
            break
          }
          p = p.parentElement
        }
        if (!inScroller) {
          out.push(
            `${el.className || el.tagName} sticks out: ${Math.round(r.left)}..${Math.round(r.right)}`,
          )
        }
      }
    }
    return out.slice(0, 6)
  }, device.width)

  if (problems.length) {
    failures++
    console.log(`  ✗ ${screen}`)
    for (const p of problems) console.log(`      ${p}`)
  } else {
    console.log(`  ✓ ${screen}`)
  }
}

async function shoot(page, device, screen) {
  await page.screenshot({ path: `${OUT}/${device.name}--${screen}.png` })
  await checkOverflow(page, device, screen)
}

for (const device of DEVICES) {
  console.log(`\n${device.name}  ${device.width}x${device.height} @${device.dpr}x`)
  const ctx = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.dpr,
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => {
    failures++
    console.log(`  ! page error: ${e.message}`)
  })

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'domcontentloaded' })

  // 1.1 Sign up
  await page.waitForSelector('text=Track what you spend.')
  await shoot(page, device, '1.1-signup')

  await page.fill('input[placeholder="Name"]', 'Thierry')
  await page.fill('input[placeholder="Email"]', `thierry+${RUN}-${device.name}@example.com`)
  await page.fill('input[placeholder="Password"]', 'ubuzima2026')
  await page.click('text=Create account')

  // 1.2 The first-run tour: first slide, one Next, then Skip out
  await page.waitForSelector('.tour-slide', { timeout: 8000 })
  await page.waitForTimeout(700)
  await shoot(page, device, '1.2-tour')
  await page.click('text=Next')
  await page.waitForTimeout(600)
  await shoot(page, device, '1.2-tour-2')
  await page.click('text=Skip')

  // The recorder is where a fresh account lands.
  await page.waitForSelector('.tabbar', { timeout: 8000 })
  await page.waitForTimeout(400)
  await shoot(page, device, '1.3-add-fresh')

  // 1.3 Nothing recorded yet — the empty state lives on its own tab now
  await page.click('.tab >> text="History"')
  await page.waitForSelector('text=No expenses yet', { timeout: 8000 })
  await page.waitForTimeout(400)
  await shoot(page, device, '1.3-empty')
  await page.click('.tab >> text="Home"')
  await page.waitForSelector('.recorder')

  // 2.1 Record an expense — the amount is typed on the phone's own keyboard
  await page.click('.amount-display')
  await page.fill('input[aria-label="Amount"]', '2400')
  await page.click('.method-btn >> text=Bank')
  await page.click('.chip >> text=Groceries')
  await shoot(page, device, '2.1-typing')
  await page.click('.cta')
  await page.waitForTimeout(300)

  // A few more, so the charts have something to draw and the home screen has
  // more than the three it shows — which is what puts "More" on the card.
  for (const [amount, method] of [
    ['850', 'Cash'],
    ['12500', 'Bank'],
    ['3200', 'Cash'],
  ]) {
    await page.click('.amount-display')
    await page.fill('input[aria-label="Amount"]', amount)
    await page.click(`.method-btn >> text=${method}`)
    await page.click('.cta')
  }
  await page.waitForTimeout(300)
  await page.evaluate(() => document.querySelector('.scroll').scrollTo(0, 99999))
  await page.waitForTimeout(200)
  await shoot(page, device, '2.1-home')
  await page.click('.spent-card')
  await page.waitForTimeout(250)
  await shoot(page, device, '2.1-home-covered')
  await page.evaluate(() => document.querySelector('.scroll').scrollTo(0, 0))

  // the history tab, and one row's editor
  await page.click('.tab >> text="History"')
  await page.waitForSelector('.tl-row')
  await shoot(page, device, '2.4-history')
  await page.click('.tl-row')
  await page.waitForSelector('.editor')
  await shoot(page, device, '2.4-history-editor')
  await page.click('.editor-cancel')

  // 3.1 Analytics
  await page.click('.tab >> text="Analytics"')
  await page.waitForSelector('text=Where the money went')
  await shoot(page, device, '3.1-stats')

  // the eye hides the totals on Analytics
  await page.click('.eye-btn')
  await page.waitForTimeout(200)
  await shoot(page, device, '3.1-stats-hidden')
  await page.click('.eye-btn')

  // the phone's back key walks back to home instead of leaving the app
  await page.evaluate(() => history.back())
  await page.waitForTimeout(300)
  await page.click('.tab >> text="Analytics"')
  await page.waitForSelector('text=Where the money went')

  // 3.2 Update balance
  await page.click('text=Update balance')
  await page.waitForSelector('text=What do you have now?')
  // The balance is asked per account now, so each field names its place.
  await page.fill('input[aria-label="Cash RWF total"]', '840000')
  await page.fill('input[aria-label="Cash TL total"]', '9600')
  await page.fill('input[aria-label="Bank USD total"]', '1240')
  await shoot(page, device, '3.2-balance')
  await page.click('.btn-save')
  await page.waitForSelector('text=Where the money went', { timeout: 8000 })

  // 3.3 Plans — a P1 plan and a safety net that trigger the violet warning
  await page.click('.card-footer-btn >> text=Plans')
  await page.waitForSelector('.sum-card')
  await page.click('text=＋ Add a plan')
  await page.fill('input[placeholder="What is it? Rent, school fees…"]', 'Rent')
  await page.fill('input[aria-label="Amount"]', '460000')
  await shoot(page, device, '3.3-plan-form')
  await page.click('text=Add plan')
  await page.waitForSelector('.plan-row')
  await page.fill('input[aria-label="Safety net"]', '140000')
  await page.click('text=Set safety net')

  // expected income, counted in with the row's switch
  await page.click('text=＋ Add income')
  await page.fill('input[placeholder="Where from? Salary, a client…"]', 'Salary')
  await page.fill('input[aria-label="Amount"]', '300000')
  await page.click('text=Add income')
  await page.waitForSelector('.toggle-sm')
  await page.click('.toggle-sm')
  await page.waitForTimeout(200)
  await shoot(page, device, '3.3-plans')

  // editing drops the form in right under the row
  await page.click('.plan-row >> text=Rent')
  await page.waitForSelector('.mini-form-card')
  await shoot(page, device, '3.3-plan-edit')
  await page.click('.mini-form-card >> text=Cancel')

  await page.click('button[aria-label="Back"]')
  await page.waitForSelector('text=Where the money went', { timeout: 8000 })
  await page.waitForTimeout(300)
  await shoot(page, device, '3.1-stats-with-balance')

  // the day-by-day graph behind the Graph toggle
  await page.click('.seg-btn >> text=Graph')
  await page.waitForSelector('.day-scroll-line')
  await shoot(page, device, '3.1-stats-graph')
  await page.click('.seg-btn >> text=Bars')

  // 4.1 Profile
  await page.click('.tab >> text="Account"')
  await page.waitForSelector('text=Main currency')
  await shoot(page, device, '4.1-profile')

  // 3.4 Currencies
  await page.click('.row-btn >> text=Currencies')
  await page.waitForSelector('text=Rates are estimates. Edit any.')
  await shoot(page, device, '3.4-currencies')
  await page.click('button[aria-label="Back"]')

  // 2.2 Categories
  await page.click('.row-btn >> text=Categories')
  await page.waitForSelector('input[placeholder="New category"]')
  await shoot(page, device, '2.2-categories')
  await page.click('button[aria-label="Back"]')

  // 6.1 Pro: its tour, the accounts it names, and a phase read on its own
  await page.click('.tab >> text="Account"')
  await page.waitForSelector('text=Pro features')
  await page.click('[aria-label="Pro features"]')
  await page.waitForSelector('.tour-slide', { timeout: 8000 })
  await page.waitForTimeout(700)
  await shoot(page, device, '6.1-pro-tour')
  await page.click('text=Done')
  await page.waitForSelector('text=Pro features')

  await page.click('.row-btn >> text=Accounts')
  await page.waitForSelector('text=＋ Add an account', { timeout: 8000 })
  await page.click('text=＋ Add an account')
  await page.fill('input[placeholder="What is it? Ziraat, Albaraka…"]', 'Ziraat')
  await shoot(page, device, '6.2-account-form')
  await page.click('text=Add account')
  await page.waitForTimeout(300)
  await shoot(page, device, '6.2-accounts')
  await page.click('button[aria-label="Back"]')
  await page.waitForSelector('.tabbar')

  // balance is asked per account now
  await page.click('.tab >> text="Analytics"')
  await page.waitForSelector('text=Where the money went')
  await page.click('text=Update balance')
  await page.waitForSelector('text=What do you have now?')
  await shoot(page, device, '6.3-balance-per-account')
  await page.click('button[aria-label="Back"]')
  await page.waitForSelector('text=Where the money went', { timeout: 8000 })

  await page.click('.card-footer-btn >> text=Phases')
  await page.waitForSelector('text=＋ Add a phase', { timeout: 8000 })
  await page.click('text=＋ Add a phase')
  await page.fill('input[placeholder="What was it? Rwanda, Back in Türkiye…"]', 'Rwanda')
  await page.fill('input[aria-label="Phase start"]', '2020-01-01')
  await shoot(page, device, '6.4-phase-form')
  await page.click('text=Add phase')
  await page.waitForSelector('.plan-row', { timeout: 8000 })
  await shoot(page, device, '6.4-phases')
  await page.click('.plan-row >> text=Rwanda')
  await page.waitForSelector('text=Spent in this phase', { timeout: 8000 })
  await shoot(page, device, '6.5-phase')
  await page.click('button[aria-label="Back"]')
  await page.waitForSelector('text=＋ Add a phase', { timeout: 8000 })
  // A second back lands on Home, which is where a step-in screen returns
  // to once its own trail has been walked.
  await page.click('button[aria-label="Back"]')
  await page.waitForSelector('.tabbar', { timeout: 8000 })
  await page.click('.tab >> text="Account"')
  await page.waitForSelector('text=Pro features')

  // 5.1 Confirm sheet
  await page.click('text=Sign out')
  await page.waitForSelector('text=You will need your password to get back in.')
  await shoot(page, device, '5.1-confirm')
  await page.click('.sheet-cancel')

  // 4.4 Change password (the strength meter)
  await page.click('.row-btn >> text=Password')
  await page.fill('input[placeholder="New password"]', 'abc123!@#')
  await shoot(page, device, '4.4-password')

  await ctx.close()
}

await browser.close()

console.log(failures ? `\n${failures} problem(s) found.` : '\nNo layout problems found.')
process.exit(failures ? 1 : 0)
