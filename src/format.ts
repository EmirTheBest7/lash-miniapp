import { getLang, t } from './i18n';

const LOCALE: Record<string, string> = { cs: 'cs-CZ', en: 'en-GB', ru: 'ru-RU', uk: 'uk-UA' };
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** 'YYYY-MM-DD' -> a Date at local noon (never shifts day across time zones). */
const d = (iso: string): Date => new Date(`${iso}T12:00:00`);

export function money(czk: number, from = false): string {
  if (czk <= 0) return t('price.ask');
  const s = `${czk.toLocaleString('cs-CZ')} Kč`;
  return from ? t('fmt.from', { p: s }) : s;
}

export function duration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return [h > 0 ? t('fmt.h', { n: h }) : '', m > 0 || h === 0 ? t('fmt.min', { n: m }) : ''].filter(Boolean).join(' ');
}

/** "Út 18." / "Вт 18" / "Tue 18": the short day-strip label (3 per row budget: 11 characters). */
export function dayShort(iso: string): string {
  const lang = getLang();
  const wd = cap(new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short' }).format(d(iso))).replace(/\.$/, '');
  return `${wd} ${d(iso).getDate()}${lang === 'cs' ? '.' : ''}`;
}

export const dayLong = (iso: string): string => cap(new Intl.DateTimeFormat(LOCALE[getLang()], { weekday: 'long', day: 'numeric', month: 'long' }).format(d(iso)));
export const monthShort = (iso: string): string => new Intl.DateTimeFormat(LOCALE[getLang()], { month: 'short' }).format(d(iso)).replace(/\.$/, '');

/** Label for a strip day: today/tomorrow are named, the rest is the short form. */
export function stripLabel(iso: string, today: string): { label: string; sub?: string } {
  const diff = Math.round((d(iso).getTime() - d(today).getTime()) / 86400000);
  const base = diff === 0 ? t('short.today') : diff === 1 ? t('short.tomorrow') : dayShort(iso);
  const first = d(iso).getDate() === 1 || diff === 0;
  return { label: base, sub: first ? monthShort(iso) : undefined };
}

export const whenLong = (date: string, time: string): string => `${dayLong(date)}, ${time}`;
export const todayIso = (serverTime: number, tz: string): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(serverTime * 1000));
export const daypart = (time: string): 'morning' | 'afternoon' | 'evening' => {
  const h = Number(time.slice(0, 2));
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
};
