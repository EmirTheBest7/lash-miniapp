import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DICT, LANGS, langFromTelegram, t } from '../src/i18n';
import '../src/i18n/adminTexts';        // the staff texts register themselves from the admin chunk: the lockstep checks cover them too

const keys = Object.keys(DICT.en);
const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const width = (s: string) => [...s.replaceAll('️', '')].length + (s.match(/\p{Extended_Pictographic}/gu) ?? []).length;

describe('i18n: cs / en / ru / uk stay in lockstep', () => {
  it('has exactly the same keys in every language', () => {
    for (const l of LANGS) expect(Object.keys(DICT[l]).sort(), l).toEqual([...keys].sort());
  });
  it('has the same placeholders in every language', () => {
    for (const k of keys) for (const l of LANGS) expect(ph(DICT[l][k]!), `${l} ${k}`).toEqual(ph(DICT.en[k]!));
  });
  it('has no empty strings', () => {
    for (const l of LANGS) for (const [k, v] of Object.entries(DICT[l])) expect(v.trim().length, `${l} ${k}`).toBeGreaterThan(0);
  });
  it('keeps short.* labels (chips, segments, back/close) within 11 characters and btn.* within 30 (emoji = 2)', () => {
    for (const l of LANGS) for (const [k, v] of Object.entries(DICT[l])) {
      if (k.startsWith('short.')) expect(width(v), `${l} ${k} "${v}"`).toBeLessThanOrEqual(11);
      if (k.startsWith('btn.')) expect(width(v), `${l} ${k} "${v}"`).toBeLessThanOrEqual(30);
    }
  });
  it('keeps every message short (a few lines): <= 160 characters, no newlines', () => {
    for (const l of LANGS) for (const [k, v] of Object.entries(DICT[l])) {
      if (!/^(err|hello|app)\./.test(k)) continue;
      expect(v.length, `${l} ${k}`).toBeLessThanOrEqual(160);
      expect(v.includes('\n'), `${l} ${k}`).toBe(false);
    }
  });
  it('maps Telegram language codes like the chat bot (cs/sk -> cs, ru, uk, else en)', () => {
    for (const [c, l] of [['cs', 'cs'], ['sk', 'cs'], ['ru', 'ru'], ['uk', 'uk'], ['de', 'en'], ['en-GB', 'en'], [undefined, 'en'], ['pl', 'en']] as const) expect(langFromTelegram(c)).toBe(l);
  });
  it('fills placeholders and falls back to English, then to the key', () => {
    expect(t('hello.title', { name: 'Eva' }, 'cs')).toBe('Ahoj, Eva');
    expect(t('does.not.exist', {}, 'ru')).toBe('does.not.exist');
  });
  it('keeps the staff texts (adm.*, vch.*, ln.*) OUT of the client dictionaries: clients never download them', () => {
    for (const l of LANGS) {
      const base = JSON.parse(readFileSync(`src/i18n/${l}.json`, 'utf8')) as Record<string, string>;
      expect(Object.keys(base).filter((k) => /^(adm|vch|ln)\./.test(k)), l).toEqual([]);
      const adm = JSON.parse(readFileSync(`src/i18n/admin/${l}.json`, 'utf8')) as Record<string, string>;
      expect(Object.keys(adm).filter((k) => !/^(adm|vch|ln)\./.test(k)), l).toEqual([]);
    }
  });
});
