import type { App } from '../useApp'
import { ACCENT } from '../components/ui'
import { TriangleIcon } from '../components/icons'

export function ErrorScreen({ app }: { app: App }) {
  // A build with no Firebase keys cannot sign anyone in, and no amount of
  // retrying will change that — so say what is actually wrong.
  if (!app.canUseCloud) {
    return (
      <div className="error-page">
        <span className="error-badge">
          <TriangleIcon />
        </span>
        <div className="error-title">Not connected yet</div>
        <div className="error-sub">
          This copy of the app was built without its Firebase keys, so it cannot
          reach your account. Fill them in and publish again.
        </div>
      </div>
    )
  }

  return (
    <div className="error-page">
      <span className="error-badge">
        <TriangleIcon />
      </span>
      <div className="error-title">Something broke</div>
      <div className="error-sub">Your expenses are safe in your account.</div>
      <button
        type="button"
        className="btn-save error-primary"
        style={{ background: ACCENT, marginTop: undefined }}
        onClick={app.retry}
      >
        Try again
      </button>
      <button
        type="button"
        className="btn-quiet mt-9"
        onClick={() => app.go(app.account ? 'home' : 'signin')}
      >
        Back to expenses
      </button>
    </div>
  )
}
