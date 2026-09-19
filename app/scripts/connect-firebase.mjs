/**
 * Points this app at a Firebase project, once.
 *
 * Give it the config block from the console and it writes the values into
 * two places: app/.env, which is what `npm run dev` reads and which stays on
 * this machine, and the FALLBACK block in src/lib/firebase.ts, which is what
 * the published app carries. Writing both means the app works everywhere —
 * on your phone, on Pages, on Vercel — without setting anything up in a
 * repository or a hosting dashboard.
 *
 * Those values are not secrets. A web app ships its Firebase config inside
 * its own JavaScript for anyone to read; firestore.rules is what keeps one
 * person's money out of another person's hands.
 *
 *   pbpaste | npm run connect:firebase          # the console's config block
 *   npm run connect:firebase -- <apiKey> <projectId>
 *
 * It finishes by running the readiness check, so you find out in the same
 * breath what still has to be switched on in the console.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { APP_DIR, FIELDS, args, gather } from './firebase-config.mjs'

const say = (line = '') => console.log(line)

const { loose } = args([])
const config = await gather(loose)

const missing = FIELDS.filter((f) => !config[f.js] && f.js !== 'storageBucket')
if (missing.length) {
  say()
  say('  Nothing to connect to.')
  say()
  say('  Copy the config from the Firebase console:')
  say('    Project settings → Your apps → your web app → Config')
  say()
  say('  Then pipe it in, or pass the two values:')
  say('    pbpaste | npm run connect:firebase')
  say('    npm run connect:firebase -- <apiKey> <projectId>')
  say()
  if (Object.keys(config).length)
    say(`  (missing: ${missing.map((f) => f.js).join(', ')})`)
  process.exit(1)
}

if (!config.storageBucket)
  config.storageBucket = `${config.projectId}.firebasestorage.app`

// ── app/.env, for npm run dev ────────────────────────────────────────────────
const env = [
  '# Written by npm run connect:firebase.',
  '# Not secrets — see the note at the top of src/lib/firebase.ts.',
  ...FIELDS.map((f) => `VITE_FB_${f.env}=${config[f.js]}`),
  '',
  '# Set to 1 to point the app at the local emulators instead.',
  '# VITE_FB_EMULATOR=1',
  '',
].join('\n')
await writeFile(new URL('.env', APP_DIR), env)

// ── the FALLBACK block, for every published copy ─────────────────────────────
const SRC = new URL('src/lib/firebase.ts', APP_DIR)
const before = await readFile(SRC, 'utf8')
const block = [
  'const FALLBACK: FirebaseOptions = {',
  `  apiKey: '${config.apiKey}',`,
  `  authDomain: '${config.authDomain}',`,
  `  projectId: '${config.projectId}',`,
  `  storageBucket: '${config.storageBucket}',`,
  `  messagingSenderId: '${config.messagingSenderId}',`,
  `  appId: '${config.appId}',`,
  '}',
].join('\n')

const pattern = /const FALLBACK: FirebaseOptions = \{[\s\S]*?\n\}/
if (!pattern.test(before)) {
  say('\n  Could not find the FALLBACK block in src/lib/firebase.ts.')
  say('  It has been renamed or reshaped — fix it by hand.\n')
  process.exit(1)
}
await writeFile(SRC, before.replace(pattern, block))

say()
say(`  Connected to ${config.projectId}.`)
say()
say('    app/.env                 written (stays on this machine)')
say('    src/lib/firebase.ts      FALLBACK filled in (goes out with the app)')
say()
say('  Commit src/lib/firebase.ts and push, and every copy of the app —')
say('  phone, Pages, Vercel — reaches this project.')
say()

// ── and straight on to whether the project is actually ready ────────────────
const check = spawnSync(process.execPath, [new URL('check-firebase.mjs', import.meta.url).pathname], {
  stdio: 'inherit',
})
process.exit(check.status ?? 0)
