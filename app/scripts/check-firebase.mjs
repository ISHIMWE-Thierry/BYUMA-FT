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
import { args, gather } from './firebase-config.mjs'

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

const { domain, loose } = args(['domain'])
const extraDomains = domain.filter(Boolean)
// --prove goes past asking: it signs up a throwaway person and puts them
// through what the app does, then removes them again.
const prove = loose.includes('--prove')
const config = await gather(loose.filter((a) => a !== '--prove'))

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
  // Google answers with the project number here, not its id, so only a
  // named project that differs is worth mentioning.
  const answers = String(project.json.projectId ?? '')
  check('The API key works', true, `answers for project ${answers}`)
  if (answers && !/^\d+$/.test(answers) && answers !== config.projectId)
    warn('The key belongs to a different project', `key says ${answers}, config says ${config.projectId}`)

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

// ── Prove it: a throwaway person does what the app does ─────────────────────
// The same REST calls the app's SDK makes, as that person, so what passes
// here passes on a phone. Both people made here delete themselves at the end.
if (prove && authReady) {
  say()
  say('Proving it with a throwaway account')
  const run = Date.now().toString(36)
  const person = async (tag) => {
    const r = await ask(`${ID}/accounts:signUp?key=${key}`, {
      email: `byuma-check-${run}-${tag}@example.com`,
      password: `check-${run}-ubuzima`,
      returnSecureToken: true,
    })
    return r.json?.idToken ? { token: r.json.idToken, uid: r.json.localId } : null
  }
  const asUser = (token) => ({ headers: { Authorization: `Bearer ${token}` } })
  const doc = (uid) => `${FS}/projects/${config.projectId}/databases/(default)/documents/users/${uid}`
  const bye = async (p) => {
    if (!p) return
    await fetch(doc(p.uid), { method: 'DELETE', ...asUser(p.token) }).catch(() => {})
    await ask(`${ID}/accounts:delete?key=${key}`, { idToken: p.token })
  }

  const me = await person('a')
  check('a person can sign up with email and password', !!me)
  let other = null
  if (me) {
    try {
      const written = await fetch(doc(me.uid), {
        method: 'PATCH',
        headers: { ...asUser(me.token).headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            items: { arrayValue: { values: [{ mapValue: { fields: { amount: { integerValue: '2400' } } } }] } },
          },
        }),
      })
      check('they can save their own document', written.ok, written.ok ? '' : `HTTP ${written.status}`)

      const read = await fetch(doc(me.uid), asUser(me.token))
      const back = await read.json().catch(() => ({}))
      const amount = back.fields?.items?.arrayValue?.values?.[0]?.mapValue?.fields?.amount?.integerValue
      check('and read it back', read.ok && amount === '2400', read.ok ? `amount ${amount}` : `HTTP ${read.status}`)

      const stranger = await fetch(doc(me.uid))
      check('a stranger is refused', stranger.status === 403 || stranger.status === 401, `HTTP ${stranger.status}`)

      other = await person('b')
      if (other) {
        const peek = await fetch(doc(me.uid), asUser(other.token))
        check('so is another signed-in person', peek.status === 403, `HTTP ${peek.status}`)
      } else {
        warn('Could not make a second person to test the rules against')
      }
    } finally {
      await bye(me)
      await bye(other)
      say('      (both throwaway accounts removed)')
    }
  }
} else if (prove) {
  warn('Skipped proving it — sign-in is not ready yet')
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
