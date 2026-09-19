/**
 * Asks your real Firebase project whether it is ready for this app, and says
 * what is missing in the same words the console uses.
 *
 * It checks the five things that stop people signing in or saving:
 *   1. the API key works at all
 *   2. the addresses the app is served from are on the authorized list
 *   3. Email/Password sign-in is turned on
 *   4. Google sign-in is turned on
 *   5. Firestore exists, and its rules keep strangers out
 *
 * Nothing here signs anyone in or writes anything: it asks about a made-up
 * address and reads a document that does not exist, which is enough to tell
 * a closed door from a missing building.
 *
 *   npm run check:firebase                 # reads app/.env
 *   npm run check:firebase -- AIzaSy... my-project-id
 *   pbpaste | npm run check:firebase       # paste the console's config block
 *
 * Extra addresses to look for on the authorized list:
 *   npm run check:firebase -- --domain byuma.vercel.app
 */

/** Where the published app lives, and so what Firebase has to allow. */
const EXPECTED_DOMAINS = ['byumarwanda.github.io']

let failures = 0
let warnings = 0

const say = (line = '') => console.log(line)
const check = (name, ok, extra = '') => {
  say(`  ${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures++
}
const warn = (name, extra = '') => {
  say(`  ! ${name}${extra ? ' — ' + extra : ''}`)
  warnings++
}
/** What to do about it, printed under the line that failed. */
const fix = (...lines) => lines.forEach((l) => say(`      ${l}`))

/** Reads whatever it is given — .env, an environment, a pasted config block. */
function readConfig(text) {
  const out = {}
  const grab = (key) => {
    // VITE_FB_API_KEY=x, apiKey: "x", "apiKey": 'x' — all the same thing.
    const m =
      text.match(new RegExp(`VITE_FB_${key.env}\\s*[=:]\\s*["']?([^"'\\s,}]+)`, 'i')) ||
      text.match(new RegExp(`["']?${key.js}["']?\\s*:\\s*["']([^"']+)["']`))
    if (m && m[1] && !m[1].startsWith('PASTE_')) out[key.js] = m[1]
  }
  grab({ env: 'API_KEY', js: 'apiKey' })
  grab({ env: 'AUTH_DOMAIN', js: 'authDomain' })
  grab({ env: 'PROJECT_ID', js: 'projectId' })
  grab({ env: 'STORAGE_BUCKET', js: 'storageBucket' })
  grab({ env: 'SENDER_ID', js: 'messagingSenderId' })
  grab({ env: 'APP_ID', js: 'appId' })
  return out
}

async function stdin() {
  // Only read it when something was actually piped in. A terminal, or no
  // terminal at all, is a character device; a pipe or a redirected file is
  // not — and waiting on the wrong one hangs the whole check.
  const { fstatSync } = await import('node:fs')
  let piped = false
  try {
    const s = fstatSync(0)
    piped = s.isFIFO() || s.isFile()
  } catch {
    return ''
  }
  if (!piped) return ''
  let text = ''
  for await (const chunk of process.stdin) text += chunk
  return text
}

const args = process.argv.slice(2)
const extraDomains = []
const loose = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--domain') extraDomains.push(args[++i])
  else loose.push(args[i])
}

// Whichever of these turns up something, in this order.
const fromEnv = Object.entries(process.env)
  .filter(([k]) => k.startsWith('VITE_FB_'))
  .map(([k, v]) => `${k}=${v}`)
  .join('\n')
const fromFile = await (async () => {
  const { readFile } = await import('node:fs/promises')
  for (const p of ['.env', '.env.local', '../.env']) {
    try {
      return await readFile(new URL(p, new URL('../', import.meta.url)), 'utf8')
    } catch {
      /* try the next one */
    }
  }
  return ''
})()

const config = {
  ...readConfig(fromFile),
  ...readConfig(fromEnv),
  ...readConfig(await stdin()),
}
// Two bare arguments are the key and the project, in that order.
if (loose[0]?.startsWith('AIza')) config.apiKey = loose[0]
if (loose[1]) config.projectId = loose[1]
if (!config.authDomain && config.projectId)
  config.authDomain = `${config.projectId}.firebaseapp.com`

say()
say('Byuma FT — Firebase check')
say()

if (!config.apiKey || !config.projectId) {
  say('  ✗ No Firebase config to check.')
  say()
  fix(
    'Copy it from the Firebase console:',
    '  Project settings → Your apps → your web app → Config',
    '',
    'Then either save it as app/.env (see app/.env.example), or run:',
    '  npm run check:firebase -- <apiKey> <projectId>',
  )
  say()
  process.exit(1)
}

say(`  project   ${config.projectId}`)
say(`  key       ${config.apiKey.slice(0, 12)}…`)
say()

const ID = 'https://identitytoolkit.googleapis.com/v1'
const key = encodeURIComponent(config.apiKey)

/** Every call here answers in the same shape, error or not. */
async function ask(url, body) {
  try {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    return { status: res.status, json, reason: json?.error?.message || '' }
  } catch (e) {
    return { status: 0, json: {}, reason: `could not reach Firebase (${e.message})` }
  }
}

// ── 1 & 2. The key, and the addresses it will answer for ────────────────────
say('Sign-in setup')

const project = await ask(`${ID}/projects?key=${key}`)
const authReady = project.status === 200

if (project.status === 0) {
  check('Firebase is reachable', false, project.reason)
} else if (!authReady) {
  const why = project.reason
  check('The API key works', false, why || `HTTP ${project.status}`)
  if (/API key not valid/i.test(why))
    fix(
      'That key does not belong to any project.',
      'Firebase console → Project settings → Your apps → Config → apiKey.',
    )
  else if (/CONFIGURATION_NOT_FOUND|not found/i.test(why))
    fix(
      'The key is real but Authentication has never been turned on.',
      'Firebase console → Authentication → Get started.',
    )
} else {
  check('The API key works', true, `answers for ${project.json.projectId}`)
  if (project.json.projectId !== config.projectId)
    warn(
      'The key belongs to a different project',
      `key says ${project.json.projectId}, config says ${config.projectId}`,
    )

  const allowed = project.json.authorizedDomains || []
  for (const d of [...EXPECTED_DOMAINS, ...extraDomains]) {
    const ok = allowed.includes(d)
    check(`${d} may sign people in`, ok)
    if (!ok)
      fix(
        'Firebase console → Authentication → Settings → Authorized domains',
        `→ Add domain → ${d}`,
      )
  }
  say(`      (allowed today: ${allowed.join(', ') || 'nothing'})`)
}

// ── 3. Email and password ───────────────────────────────────────────────────
if (authReady) {
  // An address nobody owns: the answer says whether the door exists, not
  // whether anyone is behind it.
  const probe = await ask(`${ID}/accounts:signInWithPassword?key=${key}`, {
    email: `byuma-check-${Date.now()}@example.invalid`,
    password: 'not-a-real-password',
    returnSecureToken: true,
  })
  const why = probe.reason
  if (/OPERATION_NOT_ALLOWED/.test(why)) {
    check('Email and password sign-in is on', false)
    fix(
      'Firebase console → Authentication → Sign-in method',
      '→ Email/Password → Enable → Save.',
    )
  } else if (/EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD/.test(why)) {
    check('Email and password sign-in is on', true)
  } else {
    warn('Could not tell whether email sign-in is on', why || `HTTP ${probe.status}`)
  }

  // ── 4. Google ─────────────────────────────────────────────────────────────
  const google = await ask(`${ID}/accounts:createAuthUri?key=${key}`, {
    providerId: 'google.com',
    continueUri: `https://${config.authDomain}/__/auth/handler`,
  })
  if (google.json?.authUri) {
    check('Google sign-in is on', true)
  } else if (/OPERATION_NOT_ALLOWED|INVALID_PROVIDER_ID/.test(google.reason)) {
    check('Google sign-in is on', false)
    fix(
      'Firebase console → Authentication → Sign-in method',
      '→ Google → Enable → pick a support email → Save.',
      'Without it the Google button on both sign-in screens fails.',
    )
  } else {
    warn('Could not tell whether Google sign-in is on', google.reason)
  }
}

// ── 5. Firestore, and whether the rules are doing their job ─────────────────
say()
say('Where the money is kept')

const FS = 'https://firestore.googleapis.com/v1'
const probe = await ask(
  `${FS}/projects/${config.projectId}/databases/(default)/documents/users/byuma-check-probe`,
)
const why = probe.reason

if (/Cloud Firestore API has not been used|SERVICE_DISABLED|API is not enabled/i.test(why)) {
  check('Firestore is set up', false, 'the Firestore API is off for this project')
  fix(
    'Firebase console → Firestore Database → Create database',
    '→ pick a location → Start in production mode.',
  )
} else if (/Permission denied on resource project|Requested entity was not found/i.test(why)) {
  // Google will not even say whether this project has a database, which it
  // only does for a project id that is wrong or not yours.
  check('Firestore is set up', false, `no project called ${config.projectId}`)
  fix(
    'Check the project id against Project settings → General.',
    'It is the short id, not the display name.',
  )
} else if (/database .*does not exist|does not exist for project/i.test(why)) {
  check('Firestore is set up', false, 'the project has no database yet')
  fix(
    'Firebase console → Firestore Database → Create database',
    '→ pick a location → Start in production mode.',
    'Until it exists, nothing anyone records can be saved.',
  )
} else if (probe.status === 403 || probe.status === 401) {
  // Asked as a stranger and turned away: the database is there and the rules
  // are doing exactly what firestore.rules says.
  check('Firestore is set up', true)
  check('The rules keep strangers out', true)
} else if (probe.status === 404 || probe.status === 200) {
  // A stranger got a straight answer about somebody's document.
  check('Firestore is set up', true)
  check('The rules keep strangers out', false, 'anyone on the internet can read your data')
  fix(
    'The database is still in test mode.',
    'Firebase console → Firestore Database → Rules,',
    'paste the contents of firestore.rules from this repository,',
    'and press Publish.',
  )
} else {
  warn('Could not tell what Firestore is doing', why || `HTTP ${probe.status}`)
}

// ── What it all adds up to ──────────────────────────────────────────────────
say()
if (failures === 0 && warnings === 0) {
  say('  Everything is ready. Publish the app with these values and sign in.')
} else if (failures === 0) {
  say(`  Nothing is broken, but ${warnings} thing(s) could not be checked from here.`)
} else {
  say(`  ${failures} thing(s) to fix above.`)
}
say()
process.exit(failures ? 1 : 0)
