# Byuma FT Lite

A simple personal expense tracker. You type an amount, tap how you paid
(Cash, Bank or MoMo), tap what it was for, and it is recorded. It keeps a
balance in up to three currencies, across the accounts you actually keep
money in, takes off the money you must keep, and shows you what you can
actually spend. Every check-up of the real balance tells you what moved
without a record.

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
to the front, and once an hour while it stays open. If it finds one it
swaps itself over and refreshes. Your expenses and your account are
untouched.

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

**Recording.** Type the amount, tap how you paid — **Cash**, **Bank** or
**MoMo** — tap what it was for, and it is recorded. Those three are the
only ways of paying. If you never use one, **Profile → Ways of paying**
takes it off the recorder with the eye; nothing already recorded changes.
While you type, the tab bar steps out of the way so the keyboard never
covers the three buttons.

**Spent this month**, on the home screen, is this month's total split by
how it was paid. Tap the card to show or cover the figure.

**Your balance is a check-up, not a running sum.** Every so often — every
week, say — go to **Analytics → Update balance** and type what each place
actually holds. That is a check-up. The app compares it with what the
records expected: the previous check-up, less everything recorded since,
plus any income you marked received. The difference is what moved without
a record, and Analytics keeps it under **Check-ups**: minus is spending
you never typed in, plus is money that came in unrecorded, and "matched
the records" is the goal. Between check-ups the balance still comes down
by itself as you record, so it is always the app's best estimate.

**Accounts** are the places the money sits — Ziraat, Albaraka, Vakıf, the
cash in your pocket. Each one holds **one currency**, so a check-up is one
line per account: *Albaraka, TL, 700*. Everyone starts with **Cash** and
**Bank** in their main currency; **＋ Add an account** names another and
picks its currency, and tapping a name changes or removes it. Money in
two currencies is two accounts — "Cash" and "Cash TL" — which is also how
an older save is read. Accounts are for the check-up only, not for
recording an expense. The one balance is every account added together at
today's rates, in whichever currency you are looking at, and Analytics
shows **Where the money is**, account by account, as of the last
check-up.

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
until you actually have it. On the day it lands, tap **Received**: the
money joins the balance, and the next check-up expects it. **Undo** takes
it back out if you tapped by mistake.

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

**Reminders.** Two days before a plan or an expected income is due, and
again on the day, the app puts a note on your phone. Turn it on in
**Profile → Reminders**; the phone asks once whether the app may notify
you. There is no server behind it: the app checks whenever it is open or
brought back to the front, and an installed app on Android is also woken
now and then to check while closed. On an iPhone the note appears the
next time the app is opened.

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

**Continue with Google.** The one big button, in the middle of the screen
where your thumb is. One tap, no password to invent or remember. If you
already had an account with the same email and a password, Google signs
you into that same account rather than making a second one. Email and
password sit behind **Use email instead**.

**The quick tour** opens once, right after your first sign-in — by
whichever door you came in — and then stays out of the way.

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

**The short way — from your own terminal:**

```
cd app
npm run setup:firebase
```

It signs you in to Google (a browser window opens), finds your Firebase
project or creates one, adds a web app, writes that app's config into the
code, publishes the Firestore rules, and ends with the readiness check.
The two things the command line cannot switch on — the sign-in methods and
the authorized addresses — it hands you as links to the exact console
page. Run it again after clicking them and the check turns green; then
commit and push. If you already have a project, name it:
`npm run setup:firebase -- your-project-id`.

**The long way — by hand.** In the Firebase console
(console.firebase.google.com), in your project:

1. **Authentication → Sign-in method → Email/Password → Enable.** Enable
   **Google** in the same place if you want the one-tap sign-in; it asks
   for a support email, and nothing else.
2. **Firestore Database → Create database.** Pick a region near you and
   start in production mode; the rules below replace whatever it starts
   with.
3. **Project settings → General → Your apps → Web app.** Copy the config
   block it shows (`apiKey`, `authDomain`, `projectId`, and the rest).

**Then connect the app to it.** One command takes that config block and
writes it where the app looks — `app/.env` for local runs, and the
`FALLBACK` block in `app/src/lib/firebase.ts`, which is what every
published copy carries:

```
cd app
pbpaste | npm run connect:firebase          # or: -- <apiKey> <projectId>
git commit -am "Point the app at Firebase" && git push
```

That is the whole connection: nothing to set up in the repository
settings, and nothing in a hosting dashboard. It finishes by running the
readiness check below, so you find out in the same breath what is still
switched off in the console.

**Or keep the config out of the code**, under
*Settings → Secrets and variables → Actions → Variables*, with one repository
variable per line of that config:

| Variable | From the config |
|---|---|
| `VITE_FB_API_KEY` | `apiKey` |
| `VITE_FB_AUTH_DOMAIN` | `authDomain` |
| `VITE_FB_PROJECT_ID` | `projectId` |
| `VITE_FB_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FB_SENDER_ID` | `messagingSenderId` |
| `VITE_FB_APP_ID` | `appId` |

Put them under *Variables* rather than *Secrets*: they are public either
way, and a secret is masked in the build log, which only makes trouble
harder to read. The build reads both lists, so nothing breaks if they went
into the wrong one. Hosting the app somewhere else means adding them again
in that dashboard, which is the one thing `connect:firebase` saves you.

**Publish the rules**, once:

```
npx firebase deploy --only firestore:rules
```

Until the keys are in place the app cannot reach any account, and says so
on its own screen rather than failing quietly. A published build will not
go out without them at all: the GitHub workflow stops and names the ones it
is missing, and so does a Vercel build.

**Ask the project whether it is ready.** One command checks the five things
that stop people signing in or saving — the key, the authorized addresses,
email sign-in, Google sign-in, and whether Firestore exists with its rules
published. It signs nobody in and writes nothing:

```
cd app
npm run check:firebase -- <apiKey> <projectId>
```

It also reads `app/.env` if you have one, or the config block straight off
your clipboard (`pbpaste | npm run check:firebase`). Every failure names the
console page that fixes it. Add `-- --prove` and it goes one step further:
it signs up a throwaway person with the same calls the app makes, saves and
reads their document, checks that a stranger and another signed-in person
are both refused, and removes everything it made.

**Checking it locally**, without touching the real project:

```
cd app
npm run emulators                                 # Firebase's own local Auth + Firestore
VITE_FB_EMULATOR=1 npm run build && npm run preview
npm run check:cloud        # signs up, records, syncs, migrates, checks up, checks the rules
```

An emulator build talks only to the emulators' own `demo-byuma` project,
whatever config is filled in, so it can never touch the real one.

---

## 6. Hosting it on Vercel

The app is on Vercel as well, at the same project, with nothing to set up
in its dashboard:

**https://byuma-ft-lite.vercel.app/**

Everything Vercel needs to build it is in `vercel.json` at the top of this
repository, and the Firebase config travels inside the code, so there are
no environment variables to add. The address is already on Firebase's
authorized list, so sign-in works from it.

**Publishing a new version there** is one command from the repository's
top folder, signed in to the Vercel account that owns the project:

```
npx vercel deploy --prod
```

**It publishes itself on every push.** Vercel reads the copy of this
repository at **github.com/ISHIMWE-Thierry/BYUMA-FT** — the GitHub account
the Vercel project belongs to, which is why that copy exists. Push to its
`main` and Vercel rebuilds; the workflow there also publishes a GitHub
Pages copy at **https://ishimwe-thierry.github.io/BYUMA-FT/**, because the
build takes its base path from whatever the repository is called. Keeping
the two repositories the same is one push:

```
git push https://github.com/ISHIMWE-Thierry/BYUMA-FT.git main
```

`.vercelignore` keeps the design references, the layout screenshots and
the emulator logs out of the upload — they are large and the build has no
use for them.

**Both links keep working.** GitHub Pages and Vercel are two doors into
the same Firebase project, so the same email and password show the same
money through either. Nothing needs to be moved or copied. When you are
ready to settle on one, just stop sharing the other — and on a phone that
already has the old one on its home screen, open the new link, add that
to the home screen, and delete the old icon.

One thing to know: Vercel gives every branch and pull request its own
preview address, and those addresses are not on Firebase's authorized
list. Previews will show the app but refuse to sign in, which is usually
what you want anyway.

---

## 7. Phases

A phase is a stretch of days with a name — a trip, your months in Rwanda,
a semester. There is one version of the app and phases are part of it;
the old Pro switch is gone.

**History is cut into phases and months.** Where you made a phase, the
list shows it; everywhere else it falls into months, newest first. The
strip along the top carries each one's name, and the one you pick shows
its total and how many expenses it holds.

**Start one from today.** In History, **＋ Start a phase**, a name, Save.
From then on everything you record falls into it, and its card at the top
of History keeps the running total. **End today** closes it, and the next
records go back to their months. Only one phase runs at a time. A phase
starts on a day, not at a minute, so one begun today also holds what you
recorded earlier today.

**Or draw one around days already lived.** **Analytics → Phases → ＋ Add
a phase by dates** takes a name and two dates; expenses fall in by their
date, so last summer can be named today. That screen is also where a
phase is read in full — days, average per day, how it was paid, what it
went on — and edited, ended or removed.

**Adding an expense straight into a phase.** **＋ Add** on the phase's
card in History, or **＋ Add an expense** on its page, opens a small form:
the amount, how you paid, what for, and **which day**. The day is the
guide — it opens at today while the phase runs (at the last day once it
is over) and can only be set within the phase's dates, so the expense
lands in the phase and nowhere else.

**Out of the totals, still in the graphs.** Open a phase (**Details**)
and turn **Count in totals** off. Its expenses leave Spent this month,
the category breakdown and the how-it-was-paid bars, so a trip does not
read as a bad month at home — but the day-by-day graph still draws every
day, the phase still shows its own total, and the balance still comes
down, because the money did go.

An account cannot be removed while money is still in it — quietly
dropping it would make the books lie.

---

## 8. Where the design was not followed exactly

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

3. **"Continue with Google"** was left out while accounts lived only on
   the phone — a button that does not do what it says is worse than no
   button. It came back with Firebase, and is now the main button.

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
- Three independent **eyes**: Spendable, the month card on Analytics, and
  Spent this month on the home screen each hide on their own, so you can
  cover the balance while this month's spending stays readable. Hiding covers only that figure and its own
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

## 9. How it fits different phones

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

## 10. For a developer

```bash
cd app
npm install
npm run dev          # http://localhost:5173
npm test             # 103 unit tests over the money engine
npm run build        # production build into app/dist
npm run setup:firebase   # sign in, find or create the project, connect it
npm run connect:firebase # just write a config block into the app
npm run check:firebase   # ask the project whether it is ready (-- --prove goes further)
npm run check:live       # drive the built app against the real project in a browser
npm run emulators        # Firebase's local Auth + Firestore, for the next one
npm run check:cloud      # drive an emulator build end to end (VITE_FB_EMULATOR=1 npm run build)
```

A build with no Firebase config at all warns and carries on, so the layout
checks and a quick look at the screens still work; the same build on
Vercel or Netlify stops instead.

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
  lib/calc.ts       spendable, the warnings, check-ups, phases and months, what is due
  lib/firebase.ts   the one place Firebase is set up
  lib/cloud.ts      reading and writing the one document per person
  lib/passkey.ts    unlocking with the phone's own fingerprint/face/PIN
  lib/remind.ts     reminders: asking, showing, handing the list to the worker
  lib/storage.ts    the shape of a save, and reading an older one
  sw.ts             the service worker: the saved copy of the app, reminders while closed
  useApp.ts         all state and every action
  screens/          one file per group of screens
  styles/           tokens, base (real px), app (design px)

app/scripts/
  setup-firebase.mjs    the whole Firebase setup from your own terminal
  connect-firebase.mjs  writes a config into .env and firebase.ts
  check-firebase.mjs    is the real project ready? (no emulator needed)
  check-live.mjs        the browser flow against the real project
  check-cloud.mjs       drives the app against the emulators end to end
  check-layout.mjs      every screen on four phone sizes
  make-icons.mjs        the home-screen icons from the logo
```
