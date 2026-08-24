import type { App } from '../useApp'
import { ACCENT, DANGER, FormError, LINE, PasswordField, Wordmark } from '../components/ui'
import { UnlockIcon } from '../components/icons'

const border = (app: App, field: string) => (app.errField === field ? DANGER : LINE)

/** Offered only when this phone can do it and it has been set up. */
function UnlockButton({ app, label }: { app: App; label: string }) {
  return (
    <button type="button" className="unlock" onClick={() => void app.unlockWithPhone()}>
      <UnlockIcon />
      {label}
    </button>
  )
}

export function SignUp({ app }: { app: App }) {
  return (
    <div className="page-auth">
      <div className="wordmark">
        <Wordmark />
      </div>
      <div className="headline-auth">Track what you spend.</div>

      <div className="field-group">
        <input
          className="field"
          type="text"
          autoComplete="name"
          placeholder="Name"
          value={app.fName}
          onChange={(e) => {
            app.setFName(e.target.value)
            app.clearErr()
          }}
          style={{ borderColor: border(app, 'name') }}
        />
        <input
          className="field"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="Email"
          value={app.fEmail}
          onChange={(e) => {
            app.setFEmail(e.target.value)
            app.clearErr()
          }}
          style={{ borderColor: border(app, 'email') }}
        />
        <PasswordField
          placeholder="Password"
          autoComplete="new-password"
          value={app.fPass}
          onChange={(v) => {
            app.setFPass(v)
            app.clearErr()
          }}
          borderColor={border(app, 'pass')}
        />
        <FormError message={app.formError} />
      </div>

      <button
        type="button"
        className="btn-primary mt-22"
        style={{ background: ACCENT }}
        onClick={() => void app.signUp()}
      >
        Create account
      </button>

      <div className="auth-alt">
        <span className="auth-alt-text">Already have an account?</span>
        <button
          type="button"
          className="auth-alt-link"
          style={{ color: ACCENT }}
          onClick={() => app.go('signin')}
        >
          Sign in
        </button>
      </div>
    </div>
  )
}

export function SignIn({ app }: { app: App }) {
  return (
    <div className="page-auth">
      <div className="wordmark">
        <Wordmark />
      </div>
      <div className="headline-auth">Welcome back.</div>

      <div className="field-group">
        <input
          className="field"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="Email"
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
      </div>

      <button
        type="button"
        className="btn-primary mt-22"
        style={{ background: ACCENT }}
        onClick={() => void app.signIn()}
      >
        Sign in
      </button>

      <button type="button" className="forgot-link" onClick={app.goForgot}>
        Forgot your password?
      </button>

      <div className="auth-alt">
        <span className="auth-alt-text">New here?</span>
        <button
          type="button"
          className="auth-alt-link"
          style={{ color: ACCENT }}
          onClick={() => app.go('signup')}
        >
          Create an account
        </button>
      </div>
    </div>
  )
}

/**
 * There is a mail server behind the app now: Firebase sends the reset link
 * itself. Type the address, open the link, pick a new password there. The
 * screen says the same thing whether or not that email has an account, so
 * it cannot be used to find out who is registered.
 */
export function Forgot({ app }: { app: App }) {
  return (
    <div className="page">
      <div className="headline-26">Forgot your password?</div>

      {app.sent ? (
        <>
          <div className="forgot-note">
            If {app.fEmail.trim()} has an account, a link to set a new password
            is on its way. Open it on this phone and you can sign in again.
          </div>
          <button
            type="button"
            className="btn-primary mt-22"
            style={{ background: ACCENT }}
            onClick={() => app.go('signin')}
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <div className="forgot-note">
            Type the email you signed up with and we will send you a link to
            set a new password.
          </div>
          <div className="field-group">
            <input
              className="field"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="Email"
              value={app.fEmail}
              onChange={(e) => {
                app.setFEmail(e.target.value)
                app.clearErr()
              }}
              style={{ borderColor: border(app, 'email') }}
            />
            <FormError message={app.formError} />
          </div>
          <button
            type="button"
            className="btn-primary mt-22"
            style={{ background: ACCENT }}
            onClick={() => void app.sendReset()}
          >
            Send the link
          </button>
          <button type="button" className="btn-quiet mt-9" onClick={() => app.go('signin')}>
            Back to sign in
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Firebase keeps the session, so the app opens straight into the money.
 * When phone lock is on, this stands in the way first: the same
 * fingerprint, face or PIN that unlocks the phone.
 */
export function Lock({ app }: { app: App }) {
  return (
    <div className="page-auth">
      <div className="wordmark">
        <Wordmark />
      </div>
      <div className="headline-auth">Hello, {app.account?.name || 'you'}.</div>

      <div className="field-group">
        <UnlockButton app={app} label="Unlock with your phone" />
        <FormError message={app.formError} />
      </div>

      <button type="button" className="btn-quiet mt-22" onClick={app.askSignOut}>
        Sign out instead
      </button>
    </div>
  )
}
