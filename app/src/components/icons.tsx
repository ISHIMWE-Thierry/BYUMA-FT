import type { Method } from '../types'

export const CashIcon = () => (
  <svg
    width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <rect x="2" y="5" width="16" height="10" rx="2.5" />
    <circle cx="10" cy="10" r="2.4" />
  </svg>
)

export const MomoIcon = () => (
  <svg
    width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <rect x="5.5" y="2.5" width="9" height="15" rx="2.2" />
    <path d="M8.6 14.8h2.8" />
  </svg>
)

export const BankIcon = () => (
  <svg
    width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M3 8l7-4 7 4M4.5 8v7M15.5 8v7M8 8v7M12 8v7M2.5 16.5h15" />
  </svg>
)

export const METHODS: { k: Method; label: string; Icon: () => React.ReactElement }[] = [
  { k: 'cash', label: 'Cash', Icon: CashIcon },
  { k: 'momo', label: 'MoMo', Icon: MomoIcon },
  { k: 'bank', label: 'Bank', Icon: BankIcon },
]

export const MLABEL: Record<Method, string> = { cash: 'Cash', momo: 'MoMo', bank: 'Bank' }

export const MICON: Record<Method, () => React.ReactElement> = {
  cash: CashIcon,
  momo: MomoIcon,
  bank: BankIcon,
}

export const WarnIcon = ({ color }: { color: string }) => (
  <svg
    width="16" height="16" viewBox="0 0 18 18" fill="none" stroke={color}
    strokeWidth="1.6" strokeLinecap="round"
  >
    <circle cx="9" cy="9" r="7" />
    <path d="M9 5.2v4.2M9 12.2v.1" />
  </svg>
)

export const InfoIcon = () => (
  <svg
    width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round"
  >
    <circle cx="9" cy="9" r="7" />
    <path d="M9 8.4v4M9 5.6v.1" />
  </svg>
)

export const OkIcon = ({ color }: { color: string }) => (
  <svg
    width="16" height="16" viewBox="0 0 18 18" fill="none" stroke={color}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M4 9.4l3.2 3.1L14 5.6" />
  </svg>
)

/** The small red circle used beside an inline form error. */
export const ErrorIcon = () => (
  <svg
    width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#b4553a"
    strokeWidth="1.6" strokeLinecap="round"
  >
    <circle cx="8" cy="8" r="6.4" />
    <path d="M8 4.8v3.8M8 11.1v.1" />
  </svg>
)

export const ChevronLeft = () => (
  <svg
    width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M8.5 2.5L4 7l4.5 4.5" />
  </svg>
)

export const ChevronRight = ({ size = 11, color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color}
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M5.5 2.5L10 7l-4.5 4.5" />
  </svg>
)

/* ---------------- tab bar ----------------
   Solid when the tab is the current one, outlined otherwise, so the active
   tab reads at a glance without relying on colour alone. */

export const AddIcon = ({ on = false }) => (
  <svg
    width="21" height="21" viewBox="0 0 22 22" fill="none" stroke="currentColor"
    strokeWidth={on ? 2.3 : 1.7} strokeLinecap="round"
  >
    <circle cx="11" cy="11" r="7.6" />
    <path d="M11 7.6v6.8M7.6 11h6.8" />
  </svg>
)

/** A receipt, for the list of everything recorded. */
export const HistoryIcon = ({ on = false }) => (
  <svg
    width="21" height="21" viewBox="0 0 22 22" fill={on ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth={on ? 1 : 1.6} strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M5.2 3.4h11.6v15.2l-2.3-1.5-2.3 1.5-2.3-1.5-2.4 1.5-2.3-1.5z" />
    <path d="M8.4 8h5.2M8.4 11.4h5.2" stroke={on ? '#fff' : 'currentColor'} strokeWidth="1.5" />
  </svg>
)

export const ChartIcon = ({ on = false }) => (
  <svg
    width="21" height="21" viewBox="0 0 22 22" fill="none" stroke="currentColor"
    strokeWidth={on ? 2.4 : 1.7} strokeLinecap="round"
  >
    <path d="M5.5 15.5v-4M11 15.5v-9M16.5 15.5v-6" />
  </svg>
)

export const AccountIcon = ({ on = false }) => (
  <svg
    width="21" height="21" viewBox="0 0 22 22" fill={on ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth={on ? 1 : 1.6} strokeLinecap="round"
  >
    <circle cx="11" cy="7.6" r="3.2" />
    <path d="M4.8 18c1.1-2.9 3.4-4.3 6.2-4.3s5.1 1.4 6.2 4.3" />
  </svg>
)

export const PersonIcon = () => (
  <svg
    width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round"
  >
    <circle cx="9" cy="6.4" r="2.7" />
    <path d="M3.8 14.4c.9-2.4 2.8-3.6 5.2-3.6s4.3 1.2 5.2 3.6" />
  </svg>
)

export const BarsIcon = () => (
  <svg
    width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round"
  >
    <path d="M4 12.5V8M9 12.5V4.5M14 12.5v-3" />
  </svg>
)

/** Sits in the Analytics button's place before a balance has been set. */
export const PlusSmallIcon = () => (
  <svg
    width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round"
  >
    <path d="M9 4v10M4 9h10" />
  </svg>
)

export const EyeIcon = () => (
  <svg
    width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M1.6 10S4.6 4.6 10 4.6 18.4 10 18.4 10 15.4 15.4 10 15.4 1.6 10 1.6 10z" />
    <circle cx="10" cy="10" r="2.4" />
  </svg>
)

export const EyeOffIcon = () => (
  <svg
    width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M7.9 5a7.8 7.8 0 0 1 2.1-.3c5.4 0 8.4 5.3 8.4 5.3a14 14 0 0 1-2.4 3M4.8 6.3A14 14 0 0 0 1.6 10S4.6 15.4 10 15.4c1.3 0 2.4-.3 3.4-.8" />
    <path d="M8.3 8.3a2.4 2.4 0 0 0 3.4 3.4M3 3l14 14" />
  </svg>
)

/** The phone's own unlock — fingerprint, face or PIN. */
export const UnlockIcon = () => (
  <svg
    width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M10 2.5c-2.6 0-4.7 2.1-4.7 4.7v2.4M14.7 8.4V7.2a4.7 4.7 0 0 0-1.4-3.3" />
    <path d="M5.3 12.3c0 3 2.1 5.2 4.7 5.2M10 9.1v4.3M12.6 11v2.4a4 4 0 0 1-.6 2.1" />
  </svg>
)

export const CrossIcon = ({ size = 10 }) => (
  <svg
    width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round"
  >
    <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
  </svg>
)

export const PlusIcon = () => (
  <svg
    width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="#9497a5"
    strokeWidth="1.5" strokeLinecap="round"
  >
    <path d="M10 4.5v11M4.5 10h11" />
  </svg>
)

export const BinIcon = () => (
  <svg
    width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="#9497a5"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />
  </svg>
)

export const TriangleIcon = () => (
  <svg
    width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#b4553a"
    strokeWidth="1.6" strokeLinecap="round"
  >
    <path d="M10 3.4L2.6 16.2h14.8z" />
    <path d="M10 8v3.4M10 13.8v.1" />
  </svg>
)

/** Google's mark, in its own four colours — it may not be recoloured. */
export const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 48 48">
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 1.9-1.6 4.8-4.5 6.8l-.1.3 6.5 5 .4.1c4.1-3.8 6.7-9.4 6.7-15.5z"/>
    <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9l-.3.02-6.7 5.2-.1.3C7.9 41 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5v-.3l-6.8-5.3-.2.1A22 22 0 0 0 2 24c0 3.5.9 6.9 2.5 9.9l7-5.4z"/>
    <path fill="#EB4335" d="M24 10.2c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4 29.9 2 24 2 15.4 2 7.9 7 4.5 14.1l7 5.4c1.8-5.2 6.7-9.3 12.5-9.3z"/>
  </svg>
)
