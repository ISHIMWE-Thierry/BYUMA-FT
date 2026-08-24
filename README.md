# Byuma FT Lite

A simple personal expense tracker. You type an amount, tap how you paid
(Cash, MoMo or Bank), tap what it was for, and it is recorded. It keeps a
balance in up to three currencies, takes off the money you must keep, and
shows you what you can actually spend.

The app is built exactly from the designs in the `Byuma FT Lite V2` folder.
Those files stay in this repository as the reference.

---

## 1. Putting the app on your phone

You only do this once. It takes about five minutes.

### Step 1 — Turn on the website for this repository

1. Open this page in a browser:
   **https://github.com/byumarwanda/Byuma-FT-Lite/settings/pages**
2. You will see a box titled **Build and deployment**, and under it the
   word **Source** with a dropdown.
3. Click that dropdown and choose **GitHub Actions**.
   (Do **not** choose "Deploy from a branch".)
4. That is all. There is no Save button — it saves by itself.

### Step 2 — Wait for it to build

1. Open **https://github.com/byumarwanda/Byuma-FT-Lite/actions**
2. You will see a job called **Build and publish Byuma FT**.
3. When it has a green tick ✅ next to it, the app is live. It usually
   takes one or two minutes. If it has a red ✗, tell me and I will fix it.

### Step 3 — Open it on your phone

Your app address is:

**https://byumarwanda.github.io/Byuma-FT-Lite/**

Open that link in Chrome on your Tecno.

### Step 4 — Add it to your home screen

So it opens like a normal app, without the browser bars:

**On an Android phone (your Tecno Spark 7T), in Chrome:**
1. Open the link above.
2. Tap the three dots **⋮** at the top right.
3. Tap **Add to Home screen** (on some versions it says **Install app**).
4. Tap **Add**, then **Add** again.
5. Close Chrome. You now have a **Byuma FT** icon with your other apps.

**On an iPhone (your friends), in Safari:**
1. Open the link above in **Safari** (it must be Safari, not Chrome).
2. Tap the **Share** button at the bottom — the square with an arrow
   pointing up.
3. Scroll down the list and tap **Add to Home Screen**.
4. Tap **Add** at the top right.

### Getting new versions

The app is saved onto the phone so it opens instantly and works with no
internet. That also means it has to be told when a new version exists.

**Just reload, or reopen it from the home screen.** One reload is enough:
the app checks for a new version on every start, whenever you bring it back
to the front, and every fifteen minutes. If it finds one it swaps itself
over and refreshes. Your expenses and your account are untouched.

To be sure which version you have, open **Profile** and look at the bottom
of the screen — it shows the date and time that version was built.

### Step 5 — Make your account

Open the app from your home screen and tap through **Create account**.
Your name, your email, and a password of at least 8 characters.

You will land on the home screen with **no expenses**, exactly as in the
design. Go to **Analytics → Update balance** whenever you want to tell the
app how much money you actually have.

### When the app is improved

The address above is the only link, and it never changes — it always serves
the newest version. Your phone keeps a saved copy so the app opens even
without internet; when a new version is published, the app notices the next
time you open it (or bring it back to the front) with internet on, downloads
the new version in the background, and refreshes itself within a few
seconds. You never reinstall anything and the icon on your home screen stays
the same.

To see which version you are running: open **Profile** and look at the very
bottom — a small line shows the day that version was published.

---

## 2. How the money works

**Recording an expense lowers your balance.** If your balance is
RWF 840,000 and you record RWF 2,400, your balance becomes RWF 837,600 on
its own. You do not have to correct it by hand.

**Update balance** (Analytics → Update balance) is for when you want to
correct the app — for example after counting the real cash in your pocket.
Whatever you type there replaces the old totals.

**Plans** (Analytics → Plans) is where you protect money before it is
spent. A plan is anything you know is coming: rent, school fees, a loan
payment. Each one has a name, an amount, a currency, a priority and, if
you like, a date:

- **P1 — certain.** All of its amount is set aside.
- **P2 — likely.** Half is set aside.
- **P3 — loose.** A fifth is set aside.

Below the plans sits the **Safety net** — the money you want to remain
with if every plan happened and the musts were done. **70% of it** is held
back, because in real life a person dips into their cushion, and the app
should not pretend otherwise.

And below that, **Expected income** — money on its way to you: a salary,
a client paying. Each row has a switch: flip it on and that money counts
into what you can spend before it arrives; leave it off and the app waits
until you actually have it.

So:

```
Spendable = Balance
          − (all of P1 + half of P2 + a fifth of P3)
          − 70% of Safety net
          + Expected income you count in
```

The bottom of the Plans screen shows exactly this sum with your own
numbers, so you can always see where the figure comes from.

The app warns you in two ways:

- **Red** — your balance cannot cover your P1 plans in full. It tells you
  by how much. Expected income cannot save this: money that has not
  arrived cannot pay a certain bill.
- **Violet** — the P1s are covered, but you are eating into your safety
  net.

Never both at once.

If you saved limits in an earlier version, nothing is lost: each old
**Must** became a P1 plan called "Musts", and your old safety nets were
pooled into the one safety net, in your main currency.

**Exchange rates.** The app fetches today's rates from the internet when
you open it. If you have no internet it keeps the last rates it saw. You
can type over any rate yourself, in three places — the Rates card on
Update balance, the Currencies screen, and the "add from another currency"
box. Once you type a rate yourself, the app will not overwrite it.

---

## 3. Signing in

Your account lives with Firebase now, not on one handset, so the same
email and password get you in on any phone — and what you record on one
appears on the other.

**Your password.** What you set when you created the account. The eye at the
right of any password box shows what you have typed, so you are never
guessing on a phone keyboard.

**If you forget it.** Tap **Forgot your password?** on the sign-in screen,
type your email, and a link to set a new one arrives in your inbox. Open it
on the phone and sign in again. The screen says the same thing whether or
not that email has an account, so nobody can use it to find out who is
registered.

**Your phone's fingerprint, face or PIN.** Go to **Profile → Security** and
turn on **Lock with your phone**. Because you now stay signed in, this is no
longer how you get *back* into an account — it is what stands between
someone holding your unlocked phone and your money: the app asks for your
fingerprint before it opens. Your fingerprint never leaves your phone; the
app only ever learns whether the phone said yes. It guards the phone it was
set up on; another phone needs its own.

**Changing your email** sends a link to the new address first. The account
moves over only once you open that link, so a typo cannot lock you out.

---

## 4. Where your information is kept

Your expenses live in **Firebase** — a Google service, in a project that
belongs to you. Signing in on a new phone brings everything with you, and
losing a phone no longer loses the history.

The phone still keeps a full copy, which is what lets the app open and
record with no internet at all. Anything written offline is queued and goes
up the moment there is a connection.

What guards it:

- Every account can read and write **exactly one document — its own**. That
  is written down in `firestore.rules` and enforced by Firebase itself, not
  by the app, so it holds no matter what any copy of the app tries.
- Your password is never in the app or in the database. Firebase holds it,
  hashed, and this code never sees it.
- The Firebase keys inside the app are **not secrets** — every web app ships
  them in plain sight. They identify the project; the rules are the lock.

Three things to know:

- **Deleting your account deletes it everywhere**, not just on the phone in
  your hand.
- Anyone who can unlock your phone can open the app, unless you turn on
  **Lock with your phone**.
- Expenses recorded on another phone appear when the app is opened or
  brought back to the front — not mid-screen while you are looking at it.

---

## 5. Connecting the app to Firebase

Only needed once, by whoever publishes the app.

**In the Firebase console** (console.firebase.google.com), in your project:

1. **Authentication → Sign-in method → Email/Password → Enable.**
2. **Firestore Database → Create database.** Pick a region near you and
   start in production mode; the rules below replace whatever it starts
   with.
3. **Project settings → General → Your apps → Web app.** Copy the config
   block it shows (`apiKey`, `authDomain`, `projectId`, and the rest).

**In this repository**, under
*Settings → Secrets and variables → Actions → Variables*, add one repository
variable per line of that config:

| Variable | From the config |
|---|---|
| `VITE_FB_API_KEY` | `apiKey` |
| `VITE_FB_AUTH_DOMAIN` | `authDomain` |
| `VITE_FB_PROJECT_ID` | `projectId` |
| `VITE_FB_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FB_SENDER_ID` | `messagingSenderId` |
| `VITE_FB_APP_ID` | `appId` |

They are *variables*, not secrets, because they are public either way — and
a secret would be masked in the build log, which only makes trouble harder
to read. If you would rather not use the repository settings at all, paste
the same values into the `FALLBACK` block at the top of
`app/src/lib/firebase.ts` instead.

**Publish the rules**, once:

```
npx firebase deploy --only firestore:rules
```

Until the keys are in place the app cannot reach any account, and says so
on its own screen rather than failing quietly.

**Checking it locally**, without touching the real project:

```
cd app
npm run emulators          # Firebase's own local Auth + Firestore
npm run build && npm run preview
npm run check:cloud        # signs up, records, syncs, migrates, checks the rules
```

---

## 6. Where the design was not followed exactly

Three deliberate changes. Everything else matches the designs.

1. **Recording an expense lowers the balance.** The design prototype did
   not do this — its balance only changed when you typed it. You asked for
   the expense to come off the total, so it does. Nothing on screen looks
   different; only the numbers move.

2. **Signing out goes straight back to the sign-in screen.** In the
   prototype, signing out landed on the "Something broke" screen, which
   was only a trick so that screen could be shown in the demo. On a real
   phone that would look like a fault, so signing out just signs you out.
   The "Something broke" screen is still in the app for real errors.

3. **"Continue with Google" is gone.** It cannot really work while your
   account lives only on your phone, and a button that does not do what it
   says is worse than no button.

Two smaller adjustments you asked for during the build:

- The **category strip** on the home screen now keeps the same strict left
  and right margin as everything else, and fades out at whichever edge
  still has more categories to scroll to.
- The **Cash / MoMo / Bank** buttons are 44px tall instead of 54px, so they
  stop competing with the amount. They are still clearly taller than the
  category chips.
- A small **Version** line sits at the very bottom of Profile, under
  Sign out. It shows the day the running version was published, so you can
  tell at a glance that an update has arrived.
- **Limits grew into Plans** — named plans with P1/P2/P3 priorities, one
  safety net (70% held back instead of the design's 75%), and expected
  income you can count in. Section 2 has the current formula.
- Three independent **eyes**: Spendable, This month, and Spent so far
  each hide on their own, so you can cover the balance while this month's
  spending stays readable. Hiding covers only that figure and its own
  little breakdown — the transaction list always stays visible. The old
  "Hide totals" switch left Profile; the eyes are the switch now.
- The **phone's back button** steps back one screen — or closes whatever
  sheet or form is open — instead of leaving the app. It only leaves from
  the home or sign-in screen, the way a phone app should.
- **Day by day** (Last months in the design): bars or a line, both per
  day — every day since your first record has its own bar and its own
  point, about eight days per view, sliding under the card's edge with a
  fade and docked at today. One shared scale keeps every rise and fall
  comparable, and the first tick and each 1st of a month name the month.
  Tap any bar to read that day: it takes the accent and its amount
  appears above it, with today playing that role until you pick another.
- Editing an expense offers a **Details** line for clarification. It lives
  only inside the editor — the list stays as clean as the design drew it.
- On the Plans screen each section keeps its explanation behind a small
  **(i)**, shows its own **total on the right**, and every amount field
  groups thousands with commas as you type.
- A short **first-run tour** appears once, right after sign-up: four
  swipeable slides whose pictures are working miniatures of the app's own
  cards. Skippable, and it holds still for phones that ask for reduced
  motion.
- The **Analytics button** sits quieter now — a soft wash of the accent
  instead of a solid block shouting over the screen.
- Profile → Data ends with **Delete account** — it removes the account
  and everything under it from the phone, after saying so plainly.

---

## 7. How it fits different phones

The design was drawn on a 390px-wide screen. Every single measurement —
margins, padding, corner radius, text size — is stored as a fraction of
the screen width instead of a fixed number. So the whole layout keeps
exactly the same proportions on any phone:

| Phone | Screen width | Everything scales to |
| --- | --- | --- |
| Tecno Spark 7T (720×1600) | 360px | 92% of the design |
| iPhone 14 Pro | 393px | 101% |
| iPhone 15 Pro | 393px | 101% |
| iPhone 17 Pro Max | 440px | 113% |

Checked automatically on all four: no screen scrolls sideways and nothing
runs off the edge. On a tablet or computer the app stops growing at 440px
and sits in the middle of the window.

---

## 8. For a developer

```bash
cd app
npm install
npm run dev          # http://localhost:5173
npm test             # 56 unit tests over the money engine
npm run build        # production build into app/dist
```

Layout check across all four phones (needs Playwright, which is not a
project dependency so CI stays fast):

```bash
npm install --no-save playwright
npm run build
npx vite preview --port 4173 &
node scripts/check-layout.mjs   # writes app/shots/
```

**How the responsive scaling works.** All CSS is written with the design's
literal pixel numbers. `postcss-pxtorem` converts them to `rem` at build
time with `1rem = 10 design px`, and `base.css` sets the root font size to
`min(100vw, 440px) / 39`. Hairlines of 1px are left alone so they stay
crisp. `base.css` itself is excluded from the conversion because it is
written in real viewport pixels.

**Layout of the code**

```
app/src/
  lib/money.ts      formatting, numpad rules
  lib/rates.ts      the rate table, live FX fetch, conversion
  lib/calc.ts       spendable, the warnings, balance arithmetic, aggregates
  lib/crypto.ts     PBKDF2 password hashing
  lib/passkey.ts    unlocking with the phone's own fingerprint/face/PIN
  lib/storage.ts    accounts, session and per-account data in localStorage
  useApp.ts         all state and every action
  screens/          one file per group of screens
  styles/           tokens, base (real px), app (design px)
```
