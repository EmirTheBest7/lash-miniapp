// Wall-clock helpers in the STUDIO time zone (never the phone's): the calendar must show Prague time wherever the master travels.
const fmts = new Map<string, Intl.DateTimeFormat>();
function parts(utc: number, tz: string): Record<string, number> {
  let f = fmts.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); fmts.set(tz, f); }
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(utc * 1000))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return o;
}
export const minutesOf = (utc: number, tz: string): number => { const p = parts(utc, tz); return p.hour! * 60 + p.minute!; };
export const dateOf = (utc: number, tz: string): string => { const p = parts(utc, tz); return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`; };
export const hhmm = (min: number): string => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const parseHm = (s: string): number => { const [h, m] = s.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); };
/** Local studio wall-clock (date + minutes after midnight) -> UTC epoch seconds. Two passes make it right across a DST change. */
export function toUtc(date: string, min: number, tz: string): number {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const naive = Date.UTC(y, mo - 1, d, Math.floor(min / 60), min % 60) / 1000;
  let guess = naive;
  for (let i = 0; i < 2; i++) {
    const p = parts(guess, tz);
    guess = naive - (Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!) / 1000 - guess);
  }
  return guess;
}
export const addDays = (iso: string, n: number): string => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** ISO weekday 1 = Monday of an ISO date. */
export const isoWeekday = (iso: string): number => ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
