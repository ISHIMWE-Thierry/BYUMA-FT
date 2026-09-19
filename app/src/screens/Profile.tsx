import type { App } from '../useApp'
import { METHODS } from '../lib/storage'
import { ACCENT, DANGER, FormError, LINE, PasswordField, pick } from '../components/ui'
import { ChevronRight, EyeIcon, EyeOffIcon, MICON } from '../components/icons'

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
  const { round, remind, hiddenMethods } = data.settings

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

      {/* The recorder offers these three; the eye keeps one off it. */}
      <div className="section-label">Ways of paying</div>
      <div className="list-card">
        {METHODS.map((m) => {
          const Icon = MICON[m]
          const off = hiddenMethods.includes(m)
          return (
            <div className="acc-row" key={m}>
              <span className="acc-tile" style={{ opacity: off ? 0.45 : 1 }}>
                <Icon />
              </span>
              <span className="plan-main" style={{ opacity: off ? 0.55 : 1 }}>
                <span className="plan-name">{app.methodName(m)}</span>
                <span className="plan-date">{off ? 'off the recorder' : 'on the recorder'}</span>
              </span>
              <button
                type="button"
                className="acc-eye"
                aria-label={(off ? 'Show ' : 'Hide ') + app.methodName(m)}
                onClick={() => app.toggleMethod(m)}
              >
                {off ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          )
        })}
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
        <div className="toggle-row">
          <div>
            <div className="toggle-label">Reminders</div>
            <div className="toggle-hint">
              {remind
                ? 'A note two days before, and on the day, a plan or income is due.'
                : 'Nothing is sent.'}
            </div>
          </div>
          <button
            type="button"
            className="toggle"
            role="switch"
            aria-checked={remind}
            aria-label="Reminders"
            onClick={() => void app.toggleRemind()}
            style={{
              background: remind ? ACCENT : 'rgba(20,22,31,.14)',
              justifyContent: remind ? 'flex-end' : 'flex-start',
            }}
          >
            <span />
          </button>
        </div>
        <div className="toggle-row">
          <div className="toggle-label">Round amounts</div>
          <button
            type="button"
            className="toggle"
            role="switch"
            aria-checked={round}
            aria-label="Round amounts"
            onClick={() => app.setSetting('round')}
            style={{
              background: round ? ACCENT : 'rgba(20,22,31,.14)',
              justifyContent: round ? 'flex-end' : 'flex-start',
            }}
          >
            <span />
          </button>
        </div>
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
