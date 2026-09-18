import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

/**
 * The one place Firebase is set up.
 *
 * These values are not secrets. A web app's Firebase config ships inside the
 * JavaScript of every page that uses it, by design — what actually guards the
 * data is the Firestore security rules (see firestore.rules), which only ever
 * let a signed-in person touch their own document.
 *
 * Fill them in either way:
 *   - paste them straight into FALLBACK below, or
 *   - set VITE_FB_* environment variables (locally in app/.env, and in the
 *     GitHub repository's Actions variables for the published build).
 */
const FALLBACK: FirebaseOptions = {
  apiKey: 'PASTE_API_KEY',
  authDomain: 'PASTE_PROJECT.firebaseapp.com',
  projectId: 'PASTE_PROJECT_ID',
  storageBucket: 'PASTE_PROJECT.firebasestorage.app',
  messagingSenderId: 'PASTE_SENDER_ID',
  appId: 'PASTE_APP_ID',
}

const env = import.meta.env

export const config: FirebaseOptions = {
  apiKey: env.VITE_FB_API_KEY || FALLBACK.apiKey,
  authDomain: env.VITE_FB_AUTH_DOMAIN || FALLBACK.authDomain,
  projectId: env.VITE_FB_PROJECT_ID || FALLBACK.projectId,
  storageBucket: env.VITE_FB_STORAGE_BUCKET || FALLBACK.storageBucket,
  messagingSenderId: env.VITE_FB_SENDER_ID || FALLBACK.messagingSenderId,
  appId: env.VITE_FB_APP_ID || FALLBACK.appId,
}

/** False while the placeholders are still in place, so the app can say so. */
export const isConfigured =
  !!config.apiKey && !String(config.apiKey).startsWith('PASTE_')

let authRef: Auth | null = null
let dbRef: Firestore | null = null

if (isConfigured) {
  const app = initializeApp(config)
  authRef = getAuth(app)

  // The saved copy on the phone is what makes the app work with no internet:
  // reads are served from it, and writes made offline are queued and sent up
  // the moment there is a connection again. Multi-tab keeps two open copies
  // of the app from fighting over that cache.
  dbRef = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })

  // Point at the local emulators when running the end-to-end checks.
  if (env.VITE_FB_EMULATOR) {
    connectAuthEmulator(authRef, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(dbRef, '127.0.0.1', 8080)
  }
}

export const auth = authRef
export const db = dbRef
