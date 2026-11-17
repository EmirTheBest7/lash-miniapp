import cs from './i18n/cs.json';
import en from './i18n/en.json';
import ru from './i18n/ru.json';
import uk from './i18n/uk.json';

export const LANGS = ['cs', 'en', 'ru', 'uk'] as const;
export type Lang = (typeof LANGS)[number];
export const DICT: Record<Lang, Record<string, string>> = { cs, en, ru, uk };

/** cs/sk -> cs, ru -> ru, uk -> uk, everything else -> en (same rule as the chat bot). */
export function langFromTelegram(code?: string | null): Lang {
  const c = (code ?? '').slice(0, 2).toLowerCase();
  return c === 'cs' || c === 'sk' ? 'cs' : c === 'ru' ? 'ru' : c === 'uk' ? 'uk' : 'en';
}

let current: Lang = 'en';
export const setLang = (l: Lang): void => { current = l; document.documentElement.lang = l; };
export const getLang = (): Lang => current;

export function t(key: string, params: Record<string, string | number> = {}, lang: Lang = current): string {
  const s = DICT[lang][key] ?? DICT.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}
