/** India Standard Time: UTC+05:30, no daylight saving. */
export const IST_OFFSET_MS = 330 * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Aug", or "14 Aug 2026" with the year, from an ISO date or timestamp. */
export function shortDate(iso: string, withYear = false): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}
