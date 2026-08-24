import { doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore'
import type { UserData } from '../types'
import { db } from './firebase'
import { loadAccounts, loadData, normalise } from './storage'

/**
 * The money data, kept in Firebase.
 *
 * One document per person, `users/{uid}`, holding the whole of their
 * UserData. The app has always worked by replacing that object as a whole —
 * record an expense and a new object is set — so one document matches how
 * the state is already written, and every save is atomic: the balance and
 * the expense that moved it can never land apart.
 *
 * A Firestore document holds a megabyte, and an expense is a hundred-odd
 * bytes of JSON, so this leaves room for something like eight thousand
 * expenses. Long before that the expenses would want a collection of their
 * own, paged by month.
 *
 * Reads and writes go through the phone's saved copy first, so all of this
 * keeps working with no internet; writes queue and go up on reconnection.
 */

const userDoc = (uid: string) => {
  if (!db) throw new Error('Firebase is not configured')
  return doc(db, 'users', uid)
}

/** Their saved data, or null when this account has never saved any. */
export async function loadCloud(uid: string): Promise<UserData | null> {
  const snap = await getDoc(userDoc(uid))
  if (!snap.exists()) return null
  return normalise(snap.data() as Partial<UserData>)
}

export async function saveCloud(uid: string, data: UserData): Promise<void> {
  await setDoc(userDoc(uid), { ...data, updatedAt: Date.now() })
}

export async function deleteCloud(uid: string): Promise<void> {
  await deleteDoc(userDoc(uid))
}

/**
 * What this phone already holds for an email address, from the days before
 * there was a server. It is handed up the first time that person signs in,
 * so nobody has to retype a history they already recorded.
 */
export function localDataFor(email: string): UserData | null {
  const target = email.trim().toLowerCase()
  const acc = loadAccounts().find((a) => a.email.toLowerCase() === target)
  if (!acc) return null
  const data = loadData(acc.id)
  // Only worth carrying up if there is actually something in it.
  const used =
    data.items.length > 0 ||
    data.plans.length > 0 ||
    data.incomes.length > 0 ||
    data.safety.amt > 0 ||
    Object.values(data.balances).some((v) => v !== 0)
  return used ? data : null
}
