/**
 * Design tokens (Material 3 based). Placeholder values until the design system (DIG-28)
 * is signed off; screens must read colours, type and spacing only from here.
 * Rules from the spec: tap targets ≥ 48 dp, body text ≥ 16 sp, high contrast for clinic lighting.
 */
export const colors = {
  primary: '#00695C',
  onPrimary: '#FFFFFF',
  primaryContainer: '#B2DFDB',
  surface: '#FFFFFF',
  surfaceVariant: '#F1F5F4',
  onSurface: '#1A1C1C',
  onSurfaceVariant: '#3F4948',
  outline: '#6F7978',
  error: '#B3261E',
  warning: '#8A5A00',
  bannerBg: '#FFF4CE',
  bannerText: '#5C4300',
  sourceDictated: '#3949AB',
  sourceScanned: '#6A1B9A',
  sourceTyped: '#455A64',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const type = {
  title: { fontSize: 22, fontWeight: '600' as const },
  body: { fontSize: 16 },
  label: { fontSize: 14, fontWeight: '500' as const },
} as const;

export const MIN_TAP = 48;
