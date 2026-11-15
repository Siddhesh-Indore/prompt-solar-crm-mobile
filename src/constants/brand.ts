// src/constants/brand.ts
// The app's one source of colour. Brand: navy #012169, green #76b900, white
// and black. Everything else here is a tint or neutral derived from those, or
// a status colour (danger / warning) that has to stay recognisable as such.
//
// Contrast: white text on the brand green is too weak (about 2.4:1), so text
// on green is navy (about 6:1) — use `brand.onGreen`. Green used as *text* on
// white must be `greenDark`, not `green`.
export const brand = {
  navy: '#012169',
  green: '#76b900',
  white: '#ffffff',
  black: '#000000',

  // Text on a green surface (buttons, active chips).
  onGreen: '#012169',
  // Green dark enough to read as text or an icon on white.
  greenDark: '#4d7a00',
  greenSoft: '#e4f1c6',
  greenTint: '#f3f9e6',
  greenBorder: '#cfe5a0',

  navySoft: '#e6eaf4',
  navyBorder: '#c3cde6',

  // Neutrals
  ink: '#0b0d12',
  text: '#374151',
  textMuted: '#4b5563',
  muted: '#6b7280',
  faint: '#9ca3af',
  border: '#d1d5db',
  borderLight: '#e5e7eb',
  surfaceAlt: '#f3f4f6',
  bg: '#f9fafb',

  // Status — used the same way on every screen:
  //   danger  = overdue / error      warning = waiting / needs attention
  //   success = done                 info    = scheduled / in progress
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  dangerBorder: '#fecaca',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  warningBorder: '#fde68a',
  success: '#4d7a00',
  successSoft: '#e4f1c6',
  info: '#012169',
  infoSoft: '#e6eaf4',

  violet: '#6d28d9',
  violetSoft: '#ede9fe',
} as const

export type BrandColor = keyof typeof brand
