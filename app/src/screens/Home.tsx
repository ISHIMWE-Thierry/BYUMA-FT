import { useEffect, useRef, useState } from 'react'
import type { App } from '../useApp'
import { amountIn, sumFrom, sumIn } from '../lib/calc'
import { groupTyped, sanitizeAmount } from '../lib/money'
import {
  MICON,
  ChevronRight,
  PlusSmallIcon,
  EyeIcon,
  EyeOffIcon,
} from '../components/icons'
import { ACCENT, ChipScroller, pick } from '../components/ui'

/** How many of the latest expenses the home screen shows before "More". */
const RECENT = 3

/**
 * The split of what was spent, one band per account. The design drew three
 * bands, so the first three keep exactly its colours; a Pro list longer
 * than that carries on through the same family rather than inventing a
 * rainbow.
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

  const ready = num > 0 && !!app.acc
  const ctaLabel =
    num <= 0 ? 'Record expense' : !app.acc ? 'Pick an account' : 'Record ' + app.fmt(num)

  // A balance of zero everywhere means the person has not told the app what
  // they have yet.
  const hasBalance = Object.values(data.balances).some((held) =>
    Object.values(held ?? {}).some((v) => v !== 0),
  )

  // The phone's keyboard covers the bottom of the screen while an amount or a
  // new category is being typed. The moment the expense is ready to record,
  // bring the button into view so it is never buried under the keyboard.
  useEffect(() => {
    if (ready) cta.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [ready])

  // Choosing a category is the last step, so let the keyboard go with it.
  const done = () => (document.activeElement as HTMLElement | null)?.blur()

  // Picking the account is the step after the amount, so the number
  // keyboard has done its job: it goes, and the reason comes into view
  // where the keyboard was covering it.
  const pickAcc = (id: string) => {
    app.setAcc(id)
    done()
    window.setTimeout(() => {
      noteField.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
  }

  const total = sumIn(rates, items, mainCur)
  const allSum = total || 1

  return (
    <div>
      {/* ---------------- the recorder ---------------- */}
      <div className="recorder">
        {/* The amount used to sit at the very top, a stretch for a thumb on
            a tall phone. This empty band pushes it — and everything under
            it — down to where the hand already is. */}
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />

        {/* Where the money comes out of. Up to three sit side by side as
            the design drew them; a Pro list longer than that scrolls
            sideways instead of squeezing every name thinner. */}
        {app.shownAccounts.length <= 3 ? (
          <div className="methods">
            {app.shownAccounts.map((a) => {
              const Icon = MICON[a.kind]
              return (
                <button
                  key={a.id}
                  type="button"
                  className="method-btn"
                  style={pick(app.acc === a.id)}
                  onClick={() => pickAcc(a.id)}
                >
                  <span style={{ display: 'flex' }}>
                    <Icon />
                  </span>
                  {a.name}
                </button>
              )
            })}
          </div>
        ) : (
          <ChipScroller className="methods methods-many">
            {app.shownAccounts.map((a) => {
              const Icon = MICON[a.kind]
              return (
                <button
                  key={a.id}
                  type="button"
                  className="method-btn"
                  style={pick(app.acc === a.id)}
                  onClick={() => pickAcc(a.id)}
                >
                  <span style={{ display: 'flex' }}>
                    <Icon />
                  </span>
                  {a.name}
                </button>
              )
            })}
          </ChipScroller>
        )}

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

        <ChipScroller className="chips">
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
        </ChipScroller>

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

        {items.length > 0 && (
          <button
            type="button"
            className={shown ? 'spent-card spent-open' : 'spent-card'}
            aria-expanded={shown}
            onClick={() => setShown((v) => !v)}
          >
            <span className="spent-top">
              <span className="label-sm">Spent so far</span>
              <span className="spent-eye">{shown ? <EyeOffIcon /> : <EyeIcon />}</span>
            </span>

            {shown ? (
              <>
                <span className="spent-figure">{app.fmt(total)}</span>
                <span className="mixbar">
                  {app.accounts.map((a, ix) => (
                    <span
                      key={a.id}
                      style={{
                        width:
                          Math.round((sumFrom(rates, items, a.id, mainCur) / allSum) * 1000) /
                            10 +
                          '%',
                        background: mixColour(ix),
                      }}
                    />
                  ))}
                </span>
                <span className="mixlegend">
                  {app.accounts.map((a, ix) => (
                    <span className="mixleg" key={a.id}>
                      <span className="dot-7" style={{ background: mixColour(ix) }} />
                      <span className="mix-name">{a.name}</span>
                      <span className="mix-sum">
                        {app.fmt(sumFrom(rates, items, a.id, mainCur))}
                      </span>
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
                const Icon = MICON[app.accKind(item.acc)]
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
                          app.accKind(item.acc) === 'cash'
                            ? 'rgba(20,22,31,.05)'
                            : 'rgba(20,22,31,.08)',
                      }}
                    >
                      <Icon />
                    </span>
                    <span className="tl-note">{item.note || app.accName(item.acc)}</span>
                    <span className="tl-amount">
                      {app.fmt(amountIn(rates, item, mainCur))}
                    </span>
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
