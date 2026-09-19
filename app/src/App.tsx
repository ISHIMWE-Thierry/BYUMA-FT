import { useEffect, useRef, type ReactNode } from 'react'
import { useApp } from './useApp'
import {
  ConfirmSheet,
  Freeze,
  TabBar,
  Toast,
  TopBar,
  Wordmark,
  type Tab,
} from './components/ui'
import { Forgot, Lock, SignIn, SignUp } from './screens/Auth'
import { Tour } from './screens/Tour'
import { Home } from './screens/Home'
import { History } from './screens/History'
import { Stats } from './screens/Stats'
import { Balance, PlansScreen } from './screens/Money'
import { Categories, Currencies } from './screens/Currencies'
import {
  ChangeEmail,
  ChangeName,
  ChangePassword,
  Profile,
} from './screens/Profile'
import { Phases, PhaseView } from './screens/Phases'
import { ErrorScreen } from './screens/ErrorScreen'

const TITLES: Record<string, ReactNode> = {
  home: <Wordmark />,
  stats: 'ANALYTICS',
  profile: 'PROFILE',
  name: 'YOUR NAME',
  email: 'EMAIL',
  password: 'PASSWORD',
  history: 'HISTORY',
  cats: 'CATEGORIES',
  phases: 'PHASES',
  phase: 'PHASE',
  forgot: 'PASSWORD',
  curs: 'CURRENCIES',
  balance: 'BALANCE',
  plans: 'PLANS',
}

export default function App() {
  const app = useApp()
  const { screen } = app

  // Every screen is drawn inside the same scrolling strip, so without this a
  // screen opened after scrolling down somewhere else would start halfway
  // down itself. Each new screen starts at its top.
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroll.current?.scrollTo(0, 0)
  }, [screen])

  // Nothing is drawn until the saved session has been read, so a signed-in
  // person never sees the sign-up screen flash past on start-up.
  if (!app.ready) {
    return (
      <div className="shell">
        <div className="phone" />
      </div>
    )
  }

  const bare: string[] = ['signup', 'signin', 'lock', 'error', 'tour']
  const chrome = !bare.includes(screen)

  // The four destinations reachable from the tab bar. Everything else is
  // something you stepped into, and keeps the back chevron instead.
  const TABS: Tab[] = ['home', 'history', 'stats', 'profile']
  const onTab = (TABS as string[]).includes(screen)

  return (
    <div className="shell">
      <div className="phone">
        <div ref={scroll} className={onTab ? 'scroll has-tabbar' : 'scroll'}>
          {chrome && (
            <TopBar
              title={TITLES[screen] ?? ''}
              showBack={!onTab}
              /* Account is a tab now, so the top-right shortcut to it would
                 just be the same destination twice on the same screen. */
              showProfile={false}
              profileActive={false}
              onBack={app.goBack}
              onProfile={() => app.go('profile')}
              white={screen === 'home'}
            />
          )}

          {screen === 'signup' && <SignUp app={app} />}
          {screen === 'signin' && <SignIn app={app} />}
          {screen === 'lock' && <Lock app={app} />}
          {screen === 'tour' && <Tour app={app} />}
          {screen === 'forgot' && <Forgot app={app} />}
          {screen === 'home' && <Home app={app} />}
          {screen === 'history' && <History app={app} />}
          {screen === 'stats' && <Stats app={app} />}
          {screen === 'balance' && <Balance app={app} />}
          {screen === 'plans' && <PlansScreen app={app} />}
          {screen === 'curs' && <Currencies app={app} />}
          {screen === 'cats' && <Categories app={app} />}
          {screen === 'phases' && <Phases app={app} />}
          {screen === 'phase' && <PhaseView app={app} />}
          {screen === 'profile' && <Profile app={app} />}
          {screen === 'name' && <ChangeName app={app} />}
          {screen === 'email' && <ChangeEmail app={app} />}
          {screen === 'password' && <ChangePassword app={app} />}
          {screen === 'error' && <ErrorScreen app={app} />}
        </div>

        {/* The tab bar steps aside while the amount is being typed, so the
            phone's keyboard does not push it up over the ways of paying. */}
        {onTab && !app.typing && <TabBar current={screen as Tab} onGo={(t) => app.go(t)} />}

        <Toast toast={app.toast} />
        <ConfirmSheet confirm={app.confirm} onCancel={() => app.setConfirm(null)} />
        <Freeze label={app.busy} />
      </div>
    </div>
  )
}
