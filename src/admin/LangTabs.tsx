import { useState } from 'preact/hooks';
import { api } from '../api';
import { getLang, t } from '../i18n';
import { haptic } from '../tg';
import { Button, Sheet } from '../ui/components';
import type { Lang4 } from './types';

export const LANG4: Lang4[] = ['cs', 'ru', 'uk', 'en'];

/**
 * One owner-entered text in four languages (CS · RU · UK · EN). An empty language carries a mark and says which language its clients will see instead.
 * "Translate" (only when the server says Gemini is usable) drafts the EMPTY languages from a filled one; the drafts are shown for review and only
 * copied into the fields when she taps "Use": it never overwrites a language she filled, and nothing is saved until the screen's own Save.
 */
export function LangTabs({ label, values, onChange, rows = 3, max, canTranslate, toast }: {
  label: string; values: Record<Lang4, string>; onChange: (l: Lang4, v: string) => void; rows?: number; max: number; canTranslate: boolean; toast: (s: string) => void;
}) {
  const cur = getLang() as Lang4;
  const [lang, setLang] = useState<Lang4>(LANG4.includes(cur) ? cur : 'cs');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string> | null>(null);
  const empty = LANG4.filter((l) => values[l].trim() === '');
  const filled = LANG4.filter((l) => values[l].trim() !== '');
  async function translate() {
    if (busy || filled.length === 0 || empty.length === 0) return;
    const from: Lang4 = filled.includes(lang) ? lang : (filled[0] as Lang4);
    setBusy(true);
    const r = await api<{ drafts: Record<string, string> }>('admin/translate', { text: values[from], from, to: empty });
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t(r.error.code === 'address_in_text' ? 'adm.s_addr_in_text' : r.error.code === 'limit' ? 'adm.s_tr_limit' : 'adm.s_tr_fail') + (r.error.code === 'failed' && r.error.message ? ` (${r.error.message})` : '')); return; }
    setDrafts(r.data.drafts);
  }
  function use() {
    if (!drafts) return;
    for (const l of LANG4) if (drafts[l] && values[l].trim() === '') onChange(l, drafts[l].slice(0, max));    // never over a text she wrote
    setDrafts(null); haptic.success(); toast(t('adm.s_tr_used'));
  }
  return (
    <div class="ltabs-wrap">
      <label class="field" style={{ paddingBottom: 4 }}><span>{label}</span></label>
      <div class="ltabs" role="tablist" aria-label={label}>
        {LANG4.map((l) => (
          <button role="tab" class={`ltab${values[l].trim() === '' ? ' empty' : ''}`} aria-selected={l === lang} onClick={() => setLang(l)}>
            {l.toUpperCase()}{values[l].trim() === '' ? ' ○' : ''}
          </button>
        ))}
      </div>
      <label class="field" style={{ paddingTop: 0 }}>
        <textarea rows={rows} maxLength={max} aria-label={`${label} ${lang.toUpperCase()}`} value={values[lang]} onInput={(e) => onChange(lang, (e.target as HTMLTextAreaElement).value)} />
      </label>
      {values[lang].trim() === '' && <div class="lt-note">{t('adm.s_lt_empty', { lang: lang.toUpperCase() })}</div>}
      {canTranslate && empty.length > 0 && filled.length > 0 && (
        <div class="lt-actions"><Button secondary onClick={() => void translate()} disabled={busy}>{busy ? '…' : t('adm.s_translate')}</Button></div>
      )}
      <Sheet open={drafts !== null} onClose={() => setDrafts(null)} title={t('adm.s_tr_title')}>
        {drafts && (
          <>
            <div class="lt-note">{t('adm.s_tr_note')}</div>
            {Object.keys(drafts).map((l) => (
              <label class="field" key={l}><span>{l.toUpperCase()}</span>
                <textarea rows={3} maxLength={max} value={drafts[l]} onInput={(e) => setDrafts({ ...drafts, [l]: (e.target as HTMLTextAreaElement).value })} />
              </label>
            ))}
            <div class="row2"><Button secondary onClick={() => setDrafts(null)}>{t('adm.s_tr_cancel')}</Button><Button onClick={use}>{t('adm.s_tr_use')}</Button></div>
          </>
        )}
      </Sheet>
    </div>
  );
}
