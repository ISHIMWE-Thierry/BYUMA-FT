import type { App } from '../useApp'
import type { Settings } from '../types'
import { ACCENT, DANGER, FormError, LINE, PasswordField, pick } from '../components/ui'
import { ChevronRight } from '../components/icons'

const border = (app: App, field: string) => (app.errField === field ? DANGER : LINE)

export function Profile({ app }: { app: App }) {
  const { user, data, selCurs, mainCur } = app
  const name = user?.name || 'You'
  const email = user?.email || 'not set'

  const rows = [
    { label: 'Name', value: name, to: 'name' as const },
    { label: 'Email', value: email, to: 'email' as const },
    { label: 'Password', value: '••••••••', to: 'password' as const },
    { label: 'Categories', value: String(data.cats.length), to: 'cats' as const },
    { label: 'Currencies', value: selCurs.join(' · '), to: 'curs' as const },
  ]

  const phoneOn = !!user?.passkeyId

  // Hiding moved out of here: each figure carries its own eye now.
  const toggles: { k: keyof Settings; label: string }[] = [
    { k: 'round', label: 'Round amounts' },
    { k: 'reminder', label: 'Evening reminder' },
  ]

  return (
    <div className="page">
      <div className="profile-head">
        <span className="avatar" style={{ background: ACCENT }}>
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="profile-name">{name}</div>
          <div className="profile-email">{email}</div>
        </div>
      </div>

      <div className="section-label">Account</div>
      <div className="list-card">
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            className="row-btn"
            onClick={() => app.go(r.to, 'profile')}
          >
            <span className="row-label">{r.label}</span>
            <span className="row-right">
              <span className="row-value">{r.value}</span>
              <ChevronRight size={12} color="#9497a5" />
            </span>
          </button>
        ))}
      </div>

      <div className="section-label">Main currency</div>
      <div className="main-cur">
        {selCurs.map((c) => (
          <button
            key={c}
            type="button"
            className="main-cur-btn"
            style={pick(mainCur === c, '#faf9fc', '#4b4f5e')}
            onClick={() => app.setMainCur(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {app.canUsePhone && (
        <>
          <div className="section-label">Security</div>
          <div className="list-card">
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Lock with your phone</div>
                <div className="toggle-hint">
                  {phoneOn
                    ? 'Opening the app asks for your fingerprint, face or PIN.'
                    : 'Ask for your fingerprint, face or PIN before the app opens.'}
                </div>
              </div>
              <button
                type="button"
                className="toggle"
                role="switch"
                aria-checked={phoneOn}
                aria-label="Lock with your phone"
                onClick={() =>
                  phoneOn ? app.disablePhoneUnlock() : void app.enablePhoneUnlock()
                }
                style={{
                  background: phoneOn ? ACCENT : 'rgba(20,22,31,.14)',
                  justifyContent: phoneOn ? 'flex-end' : 'flex-start',
                }}
              >
                <span />
              </button>
            </div>
          </div>
        </>
      )}

      <div className="section-label">Settings</div>
      <div className="list-card">
        {toggles.map((t) => (
          <div className="toggle-row" key={t.k}>
            <div className="toggle-label">{t.label}</div>
            <button
              type="button"
              className="toggle"
              role="switch"
              aria-checked={data.settings[t.k]}
              aria-label={t.label}
              onClick={() => app.setSetting(t.k)}
              style={{
                background: data.settings[t.k] ? ACCENT : 'rgba(20,22,31,.14)',
                justifyContent: data.settings[t.k] ? 'flex-end' : 'flex-start',
              }}
            >
              <span />
            </button>
          </div>
        ))}
      </div>

      {/* Pro sits between what the app is and what it holds: a switch, a
          line saying what it gives, and the way back into the tour. */}
      <div className="section-label">Byuma Pro</div>
      <div className="list-card">
        <div className="toggle-row">
          <div>
            <div className="toggle-label">Pro features</div>
            <div className="toggle-hint">
              {app.pro
                ? 'Your own accounts and phases. Turn it off and they are kept, just hidden.'
                : 'Name the places your money sits, and the stretches of time you spend it in.'}
            </div>
          </div>
          <button
            type="button"
            className="toggle"
            role="switch"
            aria-checked={app.pro}
            aria-label="Pro features"
            onClick={() => app.setPro(!app.pro)}
            style={{
              background: app.pro ? ACCENT : 'rgba(20,22,31,.14)',
              justifyContent: app.pro ? 'flex-end' : 'flex-start',
            }}
          >
            <span />
          </button>
        </div>
        {app.pro && (
          <>
            <button type="button" className="row-btn" onClick={app.goAccounts}>
              <span className="row-label">Accounts</span>
              <span className="row-right">
                <span className="row-value">{app.accounts.length}</span>
                <ChevronRight size={12} color="#9497a5" />
              </span>
            </button>
            <button type="button" className="row-btn" onClick={app.goPro}>
              <span className="row-label">What Pro gives you</span>
              <span className="row-right">
                <ChevronRight size={12} color="#9497a5" />
              </span>
            </button>
          </>
        )}
      </div>

      <div className="section-label">Data</div>
      <div className="list-card">
        <div className="data-row">
          <span className="data-label">Expenses</span>
          <span className="data-value">{data.items.length}</span>
        </div>
        <button type="button" className="danger-row" onClick={app.askClear}>
          Delete all expenses
        </button>
        <button type="button" className="danger-row" onClick={app.askDeleteAccount}>
          Delete account
        </button>
      </div>


      <button type="button" className="signout" onClick={app.askSignOut}>
        Sign out
      </button>

      <div className="app-version">Version {__BUILD__}</div>
    </div>
  )
}

export function ChangeName({ app }: { app: App }) {
  return (
    <div className="page">
      <input
        className="field"
        type="text"
        placeholder="Name"
        value={app.fName}
        onChange={(e) => {
          app.setFName(e.target.value)
          app.clearErr()
        }}
        style={{ borderColor: border(app, 'name') }}
      />
      <FormError message={app.formError} />
      <button
        type="button"
        className="btn-primary mt-22"
        style={{ background: ACCENT }}
        onClick={app.saveName}
      >
        Save
      </button>
    </div>
  )
}

export function ChangeEmail({ app }: { app: App }) {
  return (
    <div className="page">
      <div className="now-card">
        <div className="now-label">Now</div>
        <div className="now-value">{app.user?.email}</div>
      </div>
      <input
        className="field mt-9"
        type="email"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="New email"
        value={app.fEmail}
        onChange={(e) => {
          app.setFEmail(e.target.value)
          app.clearErr()
        }}
        style={{ borderColor: border(app, 'email') }}
      />
      <PasswordField
        placeholder="Password"
        autoComplete="current-password"
        value={app.fPass}
        onChange={(v) => {
          app.setFPass(v)
          app.clearErr()
        }}
        borderColor={border(app, 'pass')}
      />
      <FormError message={app.formError} />
      <button
        type="button"
        className="btn-primary mt-22"
        style={{ background: ACCENT }}
        onClick={() => void app.saveEmail()}
      >
        Save
      </button>
    </div>
  )
}

export function ChangePassword({ app }: { app: App }) {
  const len = app.fNew.length
  const score =
    len === 0
      ? 0
      : len < 8
        ? 1
        : /[0-9]/.test(app.fNew) && /[^a-zA-Z0-9]/.test(app.fNew)
          ? 3
          : 2
  const colors = ['rgba(20,22,31,.1)', DANGER, '#c08a2e', '#1f7a5c']
  const word = ['', 'weak', 'fair', 'strong'][score]

  return (
    <div className="page">
      <PasswordField
        placeholder="Current password"
        autoComplete="current-password"
        value={app.fPass}
        onChange={(v) => {
          app.setFPass(v)
          app.clearErr()
        }}
        borderColor={border(app, 'pass')}
      />
      <PasswordField
        placeholder="New password"
        autoComplete="new-password"
        value={app.fNew}
        onChange={(v) => {
          app.setFNew(v)
          app.clearErr()
        }}
        borderColor={border(app, 'new')}
      />
      <PasswordField
        placeholder="Repeat new password"
        autoComplete="new-password"
        value={app.fNew2}
        onChange={(v) => {
          app.setFNew2(v)
          app.clearErr()
        }}
        borderColor={border(app, 'new2')}
      />

      <div className="pw-meter">
        {[1, 2, 3].map((seg) => (
          <span
            key={seg}
            className="pw-seg"
            style={{ background: score >= seg ? colors[score] : colors[0] }}
          />
        ))}
        <span className="pw-word">{word}</span>
      </div>

      <FormError message={app.formError} />

      <button
        type="button"
        className="btn-primary mt-22"
        style={{ background: ACCENT }}
        onClick={() => void app.savePassword()}
      >
        Change password
      </button>
    </div>
  )
}
