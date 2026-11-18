import { colors, MIN_TAP, type } from './tokens';

/** WCAG relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Text colour on background: must be ≥ 7:1 (high contrast for clinic lighting).
const textPairs: [keyof typeof colors, keyof typeof colors][] = [
  ['onSurface', 'surface'],
  ['onSurfaceVariant', 'surface'],
  ['onSurface', 'surfaceContainer'],
  ['onSurfaceVariant', 'surfaceContainerHigh'],
  ['onPrimary', 'primary'],
  ['primary', 'surface'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onInfoContainer', 'infoContainer'],
  ['info', 'surface'],
  ['error', 'surface'],
  ['onError', 'error'],
  ['onErrorContainer', 'errorContainer'],
  ['warning', 'surface'],
  ['onWarningContainer', 'warningContainer'],
  ['success', 'surface'],
  ['onSuccessContainer', 'successContainer'],
  ['onBanner', 'banner'],
  ['sourceDictated', 'sourceDictatedContainer'],
  ['sourceScanned', 'sourceScannedContainer'],
  ['sourceTyped', 'sourceTypedContainer'],
];

describe('design tokens (DIG-28)', () => {
  it.each(textPairs)('%s on %s is at least 7:1', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(7);
  });

  it('outlines are at least 3:1 on the surface (non-text)', () => {
    expect(contrast(colors.outline, colors.surface)).toBeGreaterThanOrEqual(3);
  });

  it('body text is at least 16 sp and tap targets at least 48 dp', () => {
    expect(type.body.fontSize).toBeGreaterThanOrEqual(16);
    expect(type.bodyStrong.fontSize).toBeGreaterThanOrEqual(16);
    expect(MIN_TAP).toBeGreaterThanOrEqual(48);
  });
});
