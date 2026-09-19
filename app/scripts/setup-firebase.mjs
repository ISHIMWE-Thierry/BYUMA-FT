/**
 * Sets Firebase up for this app from your own terminal, in one go.
 *
 * It signs you in to Google (a browser window opens), finds your Firebase
 * project or makes one, gives it a web app, pulls that app's config into
 * the code, publishes the Firestore rules, and finishes with the readiness
 * check — so you end knowing exactly what, if anything, is left. What the
 * command line cannot switch on (the sign-in methods, the authorized
 * addresses) it hands you as links straight to the right page.
 *
 *   cd app
 *   npm run setup:firebase                 # find or create a project
 *   npm run setup:firebase -- my-project   # use this one, or create it
 *
 * Run it again any time; every step is safe to repeat. Nothing here can
 * touch anyone's money — it only ever makes the project ready to hold it.
 */
import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { APP_DIR } from './firebase-config.mjs'

const ROOT = new URL('../', APP_DIR) // where firebase.json and .firebaserc live
const wanted = process.argv[2]

const say = (line = '') => console.log(line)
const stop = (...lines) => {
  say()
  lines.forEach((l) => say(`  ${l}`))
  say()
  process.exit(1)
}
const console_ = (id, page) => `https://console.firebase.google.com/project/${id}/${page}`

/** Runs the Firebase CLI. The local copy if there is one, otherwise npx
 *  fetches it — a minute or two the first time. */
function firebase(args, { inherit = false, cwd = APP_DIR } = {}) {
  return spawnSync('npx', ['--yes', 'firebase-tools', ...args], {
    cwd: fileURLToPath(cwd),
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    maxBuffer: 16 * 1024 * 1024,
  })
}

/** The CLI's --json answer, which is {status, result} or {status, error}.
 *  Warnings from Node arrive on the same channels, so take the JSON from
 *  its first brace. */
function ask(args, opts) {
  const r = firebase([...args, '--json'], opts)
  const text = (r.stdout || '').trim()
  let parsed = null
  try {
    parsed = JSON.parse(text.slice(text.indexOf('{')))
  } catch {
    // not JSON at all — the error below will carry the last line said
  }
  const lastLine = (r.stderr || text || '').trim().split('\n').filter(Boolean).pop()
  return {
    ok: parsed?.status === 'success',
    result: parsed?.result,
    error: parsed?.error || lastLine || `exit ${r.status}`,
  }
}

say()
say('Byuma FT — Firebase setup')
say()

// ── 1. Signed in? ───────────────────────────────────────────────────────────
let list = ask(['projects:list'])
if (!list.ok && /authenticate|login|credential/i.test(list.error)) {
  if (!process.stdin.isTTY)
    stop(
      'Not signed in to Firebase, and there is no terminal to sign in from.',
      'Run this first, then come back:',
      '  npx firebase-tools login',
    )
  say('  Signing in to Google — a browser window will open.')
  say()
  const login = firebase(['login'], { inherit: true })
  if (login.status !== 0) stop('Sign-in did not finish. Run it again when you are ready.')
  list = ask(['projects:list'])
}
if (!list.ok) stop('Could not list your projects:', list.error)

// ── 2. Which project ────────────────────────────────────────────────────────
const projects = Array.isArray(list.result) ? list.result : []
const named = (p) => `${p.projectId}${p.displayName ? `  (${p.displayName})` : ''}`
let id = ''

// A project made moments ago is missing from the listing for a while, so a
// named one is also asked for directly before anyone tries to create it.
const reachable = (pid) => ask(['apps:list', 'WEB', '--project', pid]).ok

if (wanted && (projects.some((p) => p.projectId === wanted) || reachable(wanted))) {
  id = wanted
} else if (!wanted && projects.length === 1) {
  id = projects[0].projectId
} else if (!wanted && projects.length > 1) {
  // More than one: use the one that is obviously ours, or ask. "Byuma" on
  // its own is not enough — the same account hosts other Byuma things.
  const ours = projects.filter((p) => /byuma[-_ ]?ft/i.test(p.projectId + ' ' + (p.displayName || '')))
  if (ours.length === 1) id = ours[0].projectId
  else
    stop(
      'You have more than one Firebase project. Which one is for this app?',
      ...projects.map((p) => `  ${named(p)}`),
      '',
      'Run again with its id:  npm run setup:firebase -- <projectId>',
      'Or a new one:           npm run setup:firebase -- byuma-ft',
    )
}

if (!id) {
  // Nothing suitable exists: make it. A project id is global across all of
  // Google, so a plain name is often taken — add a little salt.
  const fresh = wanted || `byuma-ft-${Math.random().toString(36).slice(2, 6)}`
  say(`  No project for this app yet — creating ${fresh}.`)
  say()
  const made = firebase(['projects:create', fresh, '--display-name', 'Byuma FT'], { inherit: true })
  // The listing lags a fresh project by a few seconds, so a clean exit from
  // the CLI is the real answer; the list is only asked again for the record.
  let found = made.status === 0
  for (let i = 0; !found && i < 5; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    list = ask(['projects:list'])
    found = (list.result || []).some((p) => p.projectId === fresh)
  }
  if (!found)
    stop(
      'Google would not create it from here. The usual reason is a first',
      'Firebase project needing the terms accepted in a browser — make it at',
      '  https://console.firebase.google.com',
      'then run again:  npm run setup:firebase -- <its id>',
    )
  id = fresh
}
say(`  Project   ${id}`)

// ── 3. A web app inside it ──────────────────────────────────────────────────
const apps = ask(['apps:list', 'WEB', '--project', id])
let app = (Array.isArray(apps.result) ? apps.result : []).find((a) => a.appId)
if (!app) {
  const made = ask(['apps:create', 'WEB', 'Byuma FT', '--project', id])
  if (!made.ok || !made.result?.appId) stop('Could not add a web app to the project:', made.error)
  app = made.result
  say(`  Web app   made`)
} else {
  say(`  Web app   ${app.displayName || app.appId}`)
}

// ── 4. Its config, into the code ────────────────────────────────────────────
const cfg = ask(['apps:sdkconfig', 'WEB', app.appId, '--project', id])
const sdk = cfg.result?.sdkConfig
if (!cfg.ok || !sdk?.apiKey) stop('Could not read the web app config:', cfg.error)

const connect = spawnSync(
  process.execPath,
  [fileURLToPath(new URL('connect-firebase.mjs', import.meta.url)), '--no-check'],
  { input: JSON.stringify(sdk), stdio: ['pipe', 'inherit', 'inherit'] },
)
if (connect.status !== 0) stop('Writing the config into the app did not work — see above.')

// So `firebase deploy` and friends know the project from now on.
await writeFile(new URL('.firebaserc', ROOT), JSON.stringify({ projects: { default: id } }, null, 2) + '\n')

// ── 5. Firestore, and the rules ─────────────────────────────────────────────
const dbs = ask(['firestore:databases:list', '--project', id])
const hasDefault = (Array.isArray(dbs.result) ? dbs.result : []).some((d) =>
  /\(default\)$/.test(typeof d === 'string' ? d : d?.name || ''),
)
const todo = []

if (hasDefault) {
  say('  Firestore is there — publishing the rules.')
  say()
  const rules = firebase(['deploy', '--only', 'firestore:rules', '--project', id], {
    inherit: true,
    cwd: ROOT,
  })
  if (rules.status !== 0) todo.push(`Publish the rules yourself: ${console_(id, 'firestore/rules')}`)
} else {
  todo.push(
    `Create the database — production mode: ${console_(id, 'firestore')}`,
    '  then run this again and it publishes the rules.',
  )
}

// ── 6. What only the console can switch on ──────────────────────────────────
todo.unshift(
  `Turn on Email/Password and Google: ${console_(id, 'authentication/providers')}`,
  `Add byumarwanda.github.io as an authorized domain: ${console_(id, 'authentication/settings')}`,
)

say()
say('  Still to click, in the console:')
todo.forEach((t) => say(`    • ${t}`))
say()
say('  When they are done, the check below turns all green. Then:')
say('    git add -A && git commit -m "Connect the app to Firebase" && git push')

// ── 7. Ask the project where it stands ──────────────────────────────────────
spawnSync(process.execPath, [fileURLToPath(new URL('check-firebase.mjs', import.meta.url))], {
  stdio: 'inherit',
})
