import { useEffect, useRef, useState } from 'react'
import type { App } from '../useApp'
import type { Method } from '../types'
import { amountIn, monthItems, sumFrom, sumIn } from '../lib/calc'
import { groupTyped, sanitizeAmount } from '../lib/money'
import {
  MICON,
  ChevronRight,
  PlusSmallIcon,
  EyeIcon,
  EyeOffIcon,
} from '../components/icons'
import { ACCENT, pick } from '../components/ui'

/** How many of the latest expenses the home screen shows before "More". */
const RECENT = 3

/**
 * The split of what was spent, one band per way of paying. The design drew
 * three bands, so cash, bank and MoMo keep exactly its colours.
 */
export const MIXCOL = [ACCENT, '#4b4f5e', '#8f92a0', '#7b5ec7', '#b4553a', '#1f7a5c']
export const mixColour = (ix: number) => MIXCOL[ix % MIXCOL.length]

export function Home({ app }: { app: App }) {
  // The total is there to be read, so it shows. The eye covers it for the
  // moment someone is looking over your shoulder; leaving the tab brings it
  // back. The eye in Profile and on Analytics still hides every total at
  // once, independently of this.
  const [shown, setShown] = useState(true)
  const hidden = useRef<HTMLInputElement>(null)
  const noteField = useRef<HTMLInputElement>(null)
  const cta = useRef<HTMLButtonElement>(null)
  const { data, mainCur, num, amt } = app
  const items = data.items
  const rates = data.rates

  const ready = num > 0 && !!app.method
  const ctaLabel =
    num <= 0 ? 'Record expense' : !app.method ? 'Pick how you paid' : 'Record ' + app.fmt(num)

  // Until the first check-up the app has not been told what there is.
  const hasBalance = data.balancesAt > 0

  // The phone's keyboard covers the bottom of the screen while an amount or a
  // new category is being typed. The moment the expense is ready to record,
  // bring the button into view so it is never buried under the keyboard.
  useEffect(() => {
    if (ready) cta.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [ready])

  // Choosing a category is the last step, so let the keyboard go with it.
  const done = () => (document.activeElement as HTMLElement | null)?.blur()

  // Picking how you paid is the step after the amount, so the number
  // keyboard has done its job: it goes, and the reason comes into view
  // where the keyboard was covering it.
  const pickMethod = (m: Method) => {
    app.setMethod(m)
    done()
    window.setTimeout(() => {
      noteField.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
  }

  // This month only, leaving out any phase kept off the books.
  const month = monthItems(app.counted)
  const total = sumIn(rates, month, mainCur)
  const allSum = total || 1

  return (
    <div>
      {/* ---------------- the recorder ---------------- */}
      {/* While an amount is there the band above it folds away, so the
          figure, the ways of paying and the reason sit in the top half of
          the screen, above the keyboard. It stays folded until the expense
          is recorded: unfolding on the tap that picks the way of paying
          would move that button out from under the finger. */}
      <div className={app.typing || amt !== '' ? 'recorder recorder-typing' : 'recorder'}>
        <div className="reach" aria-hidden="true" />
        <div className="amount-display" onClick={() => hidden.current?.focus()}>
          <span
            className="amount-code"
            style={{ color: amt === '' ? '#83869a' : '#4b4f5e' }}
          >
            {mainCur}
          </span>
          <span
            className="amount-figure"
            style={{ color: amt === '' ? '#83869a' : '#14161f' }}
          >
            {amt === '' ? '0' : groupTyped(amt)}
          </span>
          <span className="amount-caret" style={{ background: ACCENT }} />
        </div>
        <input
          ref={hidden}
          className="amount-hidden-input"
          type="text"
          inputMode="decimal"
          aria-label="Amount"
          enterKeyHint="done"
          value={amt}
          onChange={(e) => app.setAmt(sanitizeAmount(e.target.value))}
          onFocus={() => app.setTyping(true)}
          onBlur={() => app.setTyping(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />

        {/* How it was paid: cash, bank, MoMo — whichever are not kept off. */}
        <div className="methods">
          {app.methods.map((m) => {
            const Icon = MICON[m]
            return (
              <button
                key={m}
                type="button"
                className="method-btn"
                style={pick(app.method === m)}
                onClick={() => pickMethod(m)}
              >
                <span style={{ display: 'flex' }}>
                  <Icon />
                </span>
                {app.methodName(m)}
              </button>
            )
          })}
        </div>

        <input
          ref={noteField}
          className="note-field"
          type="text"
          placeholder="What was it for?"
          enterKeyHint="done"
          value={app.note}
          onChange={(e) => app.setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />

        <div className="chips">
          {app.orderedCats.slice(0, 8).map((c) => {
            const on = app.note.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                type="button"
                className="chip"
                style={pick(on, '#fff', '#4b4f5e')}
                onClick={() => {
                  app.setNote(on ? '' : c)
                  done()
                }}
              >
                {c}
              </button>
            )
          })}
          <button
            type="button"
            className="chip-add"
            aria-label="Categories"
            onClick={() => app.go('cats', 'home')}
          >
            ＋
          </button>
        </div>

        <button
          ref={cta}
          type="button"
          className="cta"
          onClick={app.record}
          style={{
            background: ready ? ACCENT : 'rgba(20,22,31,.06)',
            color: ready ? '#fff' : '#8f92a0',
            cursor: num > 0 ? 'pointer' : 'default',
          }}
        >
          {ctaLabel}
        </button>
      </div>

      {/* ---------------- below the card ---------------- */}
      <div className="below">
        {!hasBalance && (
          <button
            type="button"
            className="btn-analytics"
            style={{ background: ACCENT, borderColor: ACCENT, color: '#fff' }}
            onClick={() => app.goBalance('home')}
          >
            <PlusSmallIcon />
            Add your balance
          </button>
        )}

        {month.length > 0 && (
          <button
            type="button"
            className={shown ? 'spent-card spent-open' : 'spent-card'}
            aria-expanded={shown}
            onClick={() => setShown((v) => !v)}
          >
            <span className="spent-top">
              <span className="label-sm">Spent this month</span>
              <span className="spent-eye">{shown ? <EyeOffIcon /> : <EyeIcon />}</span>
            </span>

            {shown ? (
              <>
                <span className="spent-figure">{app.fmt(total)}</span>
                <span className="mixbar">
                  {app.methods.map((m, ix) => (
                    <span
                      key={m}
                      style={{
                        width:
                          Math.round((sumFrom(rates, month, m, mainCur) / allSum) * 1000) / 10 +
                          '%',
                        background: mixColour(ix),
                      }}
                    />
                  ))}
                </span>
                <span className="mixlegend">
                  {app.methods.map((m, ix) => (
                    <span className="mixleg" key={m}>
                      <span className="dot-7" style={{ background: mixColour(ix) }} />
                      <span className="mix-name">{app.methodName(m)}</span>
                      <span className="mix-sum">{app.fmt(sumFrom(rates, month, m, mainCur))}</span>
                    </span>
                  ))}
                </span>
              </>
            ) : (
              <>
                <span className="spent-masked">••••••</span>
                <span className="spent-hint">Tap to show</span>
              </>
            )}
          </button>
        )}

        {/* The last few, so the home screen answers "what did I just spend?"
            without a trip to History. Everything else, and all the editing,
            stays one tap away behind More. */}
        {items.length > 0 && (
          <div className="recent">
            <div className="hist-head">
              <span className="label-sm">Recent</span>
              <span className="hist-count">
                {items.length === 1 ? '1 expense' : items.length + ' expenses'}
              </span>
            </div>

            <div className="tl-card recent-card">
              {items.slice(0, RECENT).map((item) => {
                const Icon = MICON[item.method]
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="tl-row recent-row"
                    onClick={() => app.go('history')}
                  >
                    <span
                      className="tl-tile"
                      style={{
                        background:
                          item.method === 'cash' ? 'rgba(20,22,31,.05)' : 'rgba(20,22,31,.08)',
                      }}
                    >
                      <Icon />
                    </span>
                    <span className="tl-note">{item.note || app.methodName(item.method)}</span>
                    <span className="tl-amount">{app.fmt(amountIn(rates, item, mainCur))}</span>
                  </button>
                )
              })}

              {items.length > RECENT && (
                <button
                  type="button"
                  className="recent-more"
                  onClick={() => app.go('history')}
                >
                  More
                  <ChevronRight />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
