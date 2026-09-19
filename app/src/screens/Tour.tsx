import { useRef, useState } from 'react'
import type { App } from '../useApp'
import { ACCENT, DANGER, VIOLET } from '../components/ui'

/**
 * The first-run tour, shown once after the first sign-in. Each slide's picture
 * is a working miniature of the real screen it explains — the same cards,
 * pills and serif figures the app is made of — so nothing here has to be
 * unlearned. Swipe or tap Next; Skip is always one tap away, and the
 * phone's back button skips too.
 */

const SLIDES = [
  {
    title: 'Record in seconds.',
    body: 'Type the amount. Tap how you paid. Tap Record. That is all.',
  },
  {
    title: 'All your money, one total.',
    body: 'RWF, TL and USD add up into one balance. When you spend, it goes down by itself.',
  },
  {
    title: 'Plans protect your money.',
    body: 'Set money aside for things coming up, and keep a safety net. What is left is what you can freely spend.',
  },
  {
    title: 'Yours, on this phone.',
    body: 'Everything stays on your phone. It works without internet, and your fingerprint or PIN signs you in.',
  },
]

function ArtRecord() {
  return (
    <div className="tm-card tm-float">
      <div className="tm-amount">
        <span className="tm-code">RWF</span>
        <span className="tm-figure">2,400</span>
        <span className="tm-caret" />
      </div>
      <div className="tm-row">
        <span className="tm-pill tm-pill-on">Cash</span>
        <span className="tm-pill">MoMo</span>
        <span className="tm-pill">Bank</span>
      </div>
      <div className="tm-row">
        <span className="tm-chip tm-pop tm-d1">Groceries</span>
        <span className="tm-chip tm-pop tm-d2">Transport</span>
        <span className="tm-chip tm-pop tm-d3">Coffee</span>
      </div>
      <div className="tm-cta">Record RWF 2,400</div>
    </div>
  )
}

function ArtBalance() {
  return (
    <div className="tm-card tm-float">
      <span className="tm-label">Balance</span>
      <div className="tm-big tm-pop tm-d1">RWF 840,000</div>
      <div className="tm-row">
        <span className="tm-pill tm-pill-on tm-bob">RWF</span>
        <span className="tm-pill tm-bob tm-bob-2">TL</span>
        <span className="tm-pill tm-bob tm-bob-3">USD</span>
      </div>
    </div>
  )
}

function ArtPlans() {
  return (
    <div className="tm-card tm-float">
      <div className="tm-plan tm-pop tm-d1">
        <span className="tm-badge" style={{ color: DANGER, borderColor: DANGER }}>
          P1
        </span>
        <span className="tm-plan-name">Rent</span>
        <span className="tm-plan-amt">60,000</span>
      </div>
      <div className="tm-plan tm-pop tm-d2">
        <span className="tm-badge" style={{ color: VIOLET, borderColor: VIOLET }}>
          P2
        </span>
        <span className="tm-plan-name">New phone</span>
        <span className="tm-plan-amt">120,000</span>
      </div>
      <div className="tm-plan tm-pop tm-d3">
        <span className="tm-badge" style={{ color: '#8f92a0', borderColor: '#8f92a0' }}>
          P3
        </span>
        <span className="tm-plan-name">Trip</span>
        <span className="tm-plan-amt">200,000</span>
      </div>
      <div className="tm-spend tm-pop tm-d4">
        <span>Spendable</span>
        <span className="tm-spend-val">RWF 322,000</span>
      </div>
    </div>
  )
}

function ArtPhone() {
  return (
    <div className="tm-phone tm-float">
      <span className="tm-notch" />
      <svg
        className="tm-finger"
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        stroke={ACCENT}
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        <path d="M32 20a14 14 0 0 0-14 14c0 5-.8 9-2.4 12.4" />
        <path d="M32 27a7 7 0 0 1 7 7c0 6-1 11.4-2.8 16" />
        <path d="M32 34c0 7-1.2 13-3.6 17.6" />
        <path d="M46 34c0 4.2-.4 8.2-1.2 11.8" />
        <path d="M46 34a14 14 0 0 0-7-12.1" />
      </svg>
      <span className="tm-phone-word">Only yours</span>
    </div>
  )
}

const ARTS = [ArtRecord, ArtBalance, ArtPlans, ArtPhone]

export function Tour({ app }: { app: App }) {
  const track = useRef<HTMLDivElement>(null)
  const [ix, setIx] = useState(0)
  const last = ix === SLIDES.length - 1

  const onScroll = () => {
    const el = track.current
    if (!el) return
    setIx(Math.min(SLIDES.length - 1, Math.round(el.scrollLeft / el.clientWidth)))
  }

  const next = () => {
    if (last) return app.finishTour()
    const el = track.current
    el?.scrollTo({ left: (ix + 1) * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="tour">
      <div className="tour-top">
        <span className="wordmark">Quick tour</span>
        <span className="tour-count">
          {ix + 1} of {SLIDES.length}
        </span>
        <button type="button" className="tour-skip" onClick={app.finishTour}>
          Skip
        </button>
      </div>

      <div className="tour-track" ref={track} onScroll={onScroll}>
        {SLIDES.map((s, k) => {
          const Art = ARTS[k]
          return (
            <div className="tour-slide" key={s.title}>
              <div className="tour-art">
                {/* Re-mounting when a slide becomes the active one replays
                    its little entrance, so each swipe feels alive. */}
                <Art key={k === ix ? 'live' : 'still'} />
              </div>
              <div className="tour-title">{s.title}</div>
              <div className="tour-body">{s.body}</div>
            </div>
          )
        })}
      </div>

      <div className="tour-dots">
        {SLIDES.map((s, k) => (
          <span
            key={s.title}
            className={k === ix ? 'tour-dot tour-dot-on' : 'tour-dot'}
            style={k === ix ? { background: ACCENT } : undefined}
          />
        ))}
      </div>

      <div className="tour-foot">
        <button
          type="button"
          className="btn-primary"
          style={{ background: ACCENT }}
          onClick={next}
        >
          {last ? 'Start' : 'Next'}
        </button>
      </div>
    </div>
  )
}
