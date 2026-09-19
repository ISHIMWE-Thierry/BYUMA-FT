/**
 * Finding a Firebase config wherever it happens to be.
 *
 * The same six values arrive in four shapes — the console's JavaScript block,
 * a .env file, the environment, or two bare arguments — so both scripts that
 * need them read them the same way.
 */
import { readFile } from 'node:fs/promises'
import { fstatSync } from 'node:fs'

/** app/ — everything here is relative to it, not to the caller's cwd. */
export const APP_DIR = new URL('../', import.meta.url)

export const FIELDS = [
  { env: 'API_KEY', js: 'apiKey' },
  { env: 'AUTH_DOMAIN', js: 'authDomain' },
  { env: 'PROJECT_ID', js: 'projectId' },
  { env: 'STORAGE_BUCKET', js: 'storageBucket' },
  { env: 'SENDER_ID', js: 'messagingSenderId' },
  { env: 'APP_ID', js: 'appId' },
]

/** Pulls whatever it recognises out of a blob of text. */
export function readConfig(text) {
  const out = {}
  if (!text) return out
  for (const f of FIELDS) {
    // VITE_FB_API_KEY=x, apiKey: "x", "apiKey": 'x' — all the same thing.
    const m =
      text.match(new RegExp(`VITE_FB_${f.env}\\s*[=:]\\s*["']?([^"'\\s,}]+)`, 'i')) ||
      text.match(new RegExp(`["']?${f.js}["']?\\s*:\\s*["']([^"']+)["']`))
    if (m && m[1] && !m[1].startsWith('PASTE_')) out[f.js] = m[1]
  }
  return out
}

/** Only read stdin when something was really piped in — waiting on a
 *  terminal, or on no terminal at all, hangs the whole script. */
async function piped() {
  let ok = false
  try {
    const s = fstatSync(0)
    ok = s.isFIFO() || s.isFile()
  } catch {
    return ''
  }
  if (!ok) return ''
  let text = ''
  for await (const chunk of process.stdin) text += chunk
  return text
}

async function file(name) {
  try {
    return await readFile(new URL(name, APP_DIR), 'utf8')
  } catch {
    return ''
  }
}

/**
 * Everything we can find, later sources winning: a .env on disk, then the
 * environment, then anything piped in, then bare arguments.
 */
export async function gather(loose = []) {
  const config = {
    ...readConfig(await file('.env')),
    ...readConfig(await file('.env.local')),
    ...readConfig(
      Object.entries(process.env)
        .filter(([k]) => k.startsWith('VITE_FB_'))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n'),
    ),
    ...readConfig(await piped()),
  }
  // Two bare arguments are the key and the project, in that order.
  if (loose[0]?.startsWith('AIza')) config.apiKey = loose[0]
  if (loose[1]) config.projectId = loose[1]
  if (!config.authDomain && config.projectId)
    config.authDomain = `${config.projectId}.firebaseapp.com`
  return config
}

/** Splits `--flag value` out of the arguments, leaving the bare ones. */
export function args(flags = []) {
  const argv = process.argv.slice(2)
  const found = Object.fromEntries(flags.map((f) => [f, []]))
  const loose = []
  for (let i = 0; i < argv.length; i++) {
    const flag = flags.find((f) => argv[i] === `--${f}`)
    if (flag) found[flag].push(argv[++i])
    else loose.push(argv[i])
  }
  return { ...found, loose }
}
