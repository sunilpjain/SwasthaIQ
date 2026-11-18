/**
 * Design tokens: SwasthyaIQ Design System v1 (DIG-28), exported from the Figma library
 * "SwasthyaIQ Design System (DIG-28)" (https://www.figma.com/design/gesNzlq8x6ylvt8tdt8INh).
 * Names match the Figma variables' code syntax (color/on-primary → colors.onPrimary).
 *
 * Rules: light theme only; every text colour ≥ 7:1 on its background (outlines ≥ 3:1), checked in
 * tokens.test.ts; tap targets ≥ 48 dp; body text ≥ 16 sp. Brand = Cognihealth purple (primary) and
 * magenta (brandAccent: brand moments only, never buttons, so it is not confused with error red).
 * Screens must read colours, type and spacing only from here.
 */
export const palette = {
  purple10: '#221A32',
  purple40: '#634C91',
  purple90: '#E8E4F1',
  magenta40: '#A52556',
  magenta50: '#CA2E69',
  blue10: '#0F2B3D',
  blue30: '#1A4F73',
  blue40: '#1E5C86',
  blue90: '#DEEDF7',
  plum40: '#500040',
  plum90: '#F7DEF2',
  slate40: '#3F4A55',
  slate90: '#ECEFF2',
  neutral0: '#FFFFFF',
  neutral96: '#F3F2F7',
  neutral92: '#E8E6EF',
  neutral80: '#C9C5D0',
  neutral50: '#78767F',
  neutral30: '#47454F',
  neutral10: '#1C1B20',
  red10: '#410E0B',
  red40: '#A8231C',
  red90: '#F9DEDC',
  amber10: '#2A1800',
  amber30: '#5C4300',
  amber40: '#7A4F00',
  amber90: '#FFDDB3',
  amber95: '#FFF4CE',
  green10: '#0A2410',
  green40: '#1B5E2B',
  green90: '#C8F0CF',
} as const;

const p = palette;

export const colors = {
  primary: p.purple40,
  onPrimary: p.neutral0,
  primaryContainer: p.purple90,
  onPrimaryContainer: p.purple10,
  brandAccent: p.magenta50,
  brandAccentText: p.magenta40,
  info: p.blue40,
  infoContainer: p.blue90,
  onInfoContainer: p.blue10,
  surface: p.neutral0,
  surfaceContainer: p.neutral96,
  surfaceContainerHigh: p.neutral92,
  onSurface: p.neutral10,
  onSurfaceVariant: p.neutral30,
  outline: p.neutral50,
  outlineVariant: p.neutral80,
  error: p.red40,
  onError: p.neutral0,
  errorContainer: p.red90,
  onErrorContainer: p.red10,
  warning: p.amber40,
  warningContainer: p.amber90,
  onWarningContainer: p.amber10,
  success: p.green40,
  successContainer: p.green90,
  onSuccessContainer: p.green10,
  banner: p.amber95,
  onBanner: p.amber30,
  sourceDictated: p.blue30,
  sourceDictatedContainer: p.blue90,
  sourceScanned: p.plum40,
  sourceScannedContainer: p.plum90,
  sourceTyped: p.slate40,
  sourceTypedContainer: p.slate90,
} as const;

export const spacing = { '2xs': 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;

/** Roboto (Android system font). Line heights in sp. Body text never below 16. */
export const type = {
  headline: { fontSize: 24, lineHeight: 32, fontWeight: '500' as const },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '500' as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '500' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '500' as const },
  labelLarge: { fontSize: 16, lineHeight: 20, fontWeight: '500' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

export const size = { icon: 24 } as const;

export const MIN_TAP = 48;
