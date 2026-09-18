import type { App } from '../useApp'
import { today } from '../useApp'
import type { Expense } from '../types'
import { amountIn, byDay, sumIn } from '../lib/calc'
import { groupTyped, sanitizeAmount } from '../lib/money'
import {
  BinIcon,
  CrossIcon,
  MICON,
  PlusIcon,
} from '../components/icons'
import { ACCENT, LINE, pick } from '../components/ui'

/**
 * Everything recorded, newest first, grouped by day. Lifted off the recorder
 * so that screen is only about capturing an expense in a few seconds; reading
 * back over the week is a different job and now has its own tab.
 *
 * Tapping a row opens the editor beneath it - amount, note, details, method
 * and the day it happened. The cross deletes, and always asks first.
 */
export function History({ app }: { app: App }) {
  const { data, mainCur } = app
  const items = data.items
  const rates = data.rates
  const groups = byDay(items)

  if (items.length === 0) {
    return (
      <div className="page">
        <div className="empty">
          <span className="empty-badge">{data.cleared ? <BinIcon /> : <PlusIcon />}</span>
          <div className="empty-title">
            {data.cleared ? 'Everything deleted' : 'No expenses yet'}
          </div>
          <div className="empty-sub">
            {data.cleared ? 'Nothing left to show.' : 'Your first one lands here.'}
          </div>
          <button
            type="button"
            className="btn-analytics empty-action"
            style={{ background: ACCENT, borderColor: ACCENT, color: '#fff' }}
            onClick={() => app.go('home')}
          >
            Record one
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="hist-head">
        <span className="label-sm">All expenses</span>
        <span className="hist-count">
          {items.length === 1 ? '1 expense' : items.length + ' expenses'}
        </span>
      </div>

      <div className="timeline timeline-top">
        {groups.map((g) => (
          <div className="tl-group" key={g.off}>
            <span className="tl-rule" />
            <span
              className="tl-dot"
              style={{ background: g.off === 0 ? ACCENT : 'rgba(20,22,31,.22)' }}
            />
            <div className="tl-head">
              <span className="tl-day">{g.label}</span>
              <span className="tl-sum">{app.fmt(sumIn(rates, g.items, mainCur))}</span>
            </div>
            <div className="tl-card">
              {g.items.map((item, ix) => (
                <Row key={item.id} app={app} item={item} first={ix === 0} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Row({ app, item, first }: { app: App; item: Expense; first: boolean }) {
  const Icon = MICON[app.accKind(item.acc)]
  const editing = app.editId === item.id
  const shown = amountIn(app.data.rates, item, app.mainCur)

  return (
    <div style={{ borderTop: first ? '1px solid transparent' : '1px solid rgba(20,22,31,.055)' }}>
      <div className="tl-row" onClick={() => app.openEditor(item)}>
        <span
          className="tl-tile"
          style={{
            background:
              app.accKind(item.acc) === 'cash'
                ? 'rgba(20,22,31,.05)'
                : 'rgba(20,22,31,.08)',
          }}
        >
          <Icon />
        </span>
        <span className="tl-note">{item.note || app.accName(item.acc)}</span>
        <span className="tl-amount">{app.fmt(shown)}</span>
        <button
          type="button"
          className="x-btn"
          aria-label="Delete"
          onClick={(e) => {
            e.stopPropagation()
            app.askDelete(item)
          }}
        >
          <CrossIcon />
        </button>
      </div>

      {editing && (
        <div className="editor">
          <div className="editor-amt">
            <span className="editor-amt-label">Amount</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label="Amount"
              value={app.eAmt ? groupTyped(app.eAmt) : ''}
              onChange={(e) => app.setEAmt(sanitizeAmount(e.target.value))}
            />
          </div>
          <input
            className="editor-note"
            type="text"
            placeholder="What was it for?"
            value={app.eNote}
            onChange={(e) => app.setENote(e.target.value)}
          />
          <input
            className="editor-note"
            type="text"
            placeholder="Details, if it needs any"
            value={app.eDetail}
            onChange={(e) => app.setEDetail(e.target.value)}
          />
          <div className="editor-date">
            <span className="editor-date-label">Date</span>
            <input
              type="date"
              aria-label="Date"
              max={today()}
              value={app.eDate}
              onChange={(e) => app.setEDate(e.target.value)}
            />
          </div>
          {/* Moving an expense to another account moves the money with
              it: the whole amount goes back where it was and comes out of
              the new one. */}
          <div className="editor-methods">
            {app.accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                className="editor-method"
                style={pick(app.eAcc === a.id)}
                onClick={() => app.setEAcc(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
          <div className="editor-actions">
            <button
              type="button"
              className="editor-cancel"
              onClick={() => app.openEditor(item)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="editor-save"
              style={{ background: ACCENT, borderColor: LINE }}
              onClick={() => app.saveEdit(item)}
            >
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
