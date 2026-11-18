import { useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Switch } from '../ui/components';
import { LangTabs } from './LangTabs';
import type { Lang4, ReviewLink } from './types';
import type { Ctx } from './useSettings';

const platformOf = (url: string): string => {
  const h = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();
  if (h.includes('google.') || h === 'g.page' || h.endsWith('goo.gl') || h.includes('g.co')) return 'Google';
  if (h.includes('firmy.cz')) return 'Firmy.cz';
  if (h.includes('facebook.com') || h === 'fb.me') return 'Facebook';
  if (h.includes('tripadvisor.')) return 'TripAdvisor';
  if (h.includes('yelp.')) return 'Yelp';
  return '';
};
const empty = (): ReviewLink => ({ id: '', platform: 'other', label: { cs: '', ru: '', uk: '', en: '' }, url: '', enabled: true });

/** Up to 4 review links (any platform): the https URL, an optional label per language, on/off. One button per enabled link goes into the review message. */
export function ReviewLinksEditor({ c }: { c: Ctx }) {
  const [links, setLinks] = useState<ReviewLink[]>(c.s.review_links ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<number | null>(null);
  const patch = (i: number, p: Partial<ReviewLink>) => { setLinks((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l))); setErr(null); };
  async function save() {
    if (busy) return;
    const bad = links.findIndex((l) => !/^https:\/\/\S{4,}$/i.test(l.url.trim()));
    if (bad >= 0) { setErr(bad); haptic.error(); return; }
    setBusy(true);
    const r = await api<{ links: ReviewLink[] }>('admin/review/save', { links: links.map((l) => ({ ...l, url: l.url.trim() })) }, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); c.toast(t(r.error.code === 'address_in_text' ? 'adm.s_addr_in_text' : 'adm.bad_input')); return; }
    setLinks(r.data.links); haptic.success(); c.toast(t('adm.saved')); await c.reloadBoot(); void c.reloadHome();
  }
  return (
    <>
      {links.map((l, i) => (
        <Section key={l.id || i} title={t('adm.rv_link', { n: i + 1 })} footer={platformOf(l.url) ? t('adm.rv_platform', { p: platformOf(l.url) }) : undefined}>
          <label class="field"><span>{t('adm.rv_url')}</span><input type="url" inputMode="url" placeholder="https://…" maxLength={500} value={l.url} onInput={(e) => patch(i, { url: (e.target as HTMLInputElement).value })} /></label>
          {err === i && <div class="field-err" role="alert">{t('adm.rv_https')}</div>}
          <LangTabs label={t('adm.rv_label')} values={l.label as Record<Lang4, string>} rows={1} max={40} canTranslate={!!c.home?.translate} toast={c.toast} onChange={(lang, v) => patch(i, { label: { ...l.label, [lang]: v } })} />
          <div class="note">{t('adm.rv_label_note')}</div>
          <Cell title={t('adm.rv_on')} after={<Switch label={t('adm.rv_on')} checked={l.enabled} onChange={(on) => patch(i, { enabled: on })} />} />
          <Cell title={t('adm.rv_remove')} destructive onClick={() => setLinks((ls) => ls.filter((_, k) => k !== i))} />
        </Section>
      ))}
      <Section footer={t('adm.rv_note')}>
        {links.length < 4 && <Cell icon="plus" title={t('adm.rv_add')} onClick={() => setLinks((ls) => [...ls, empty()])} />}
      </Section>
      <div class="lt-actions"><Button secondary onClick={() => void save()} disabled={busy}>{busy ? '…' : t('adm.save')}</Button></div>
    </>
  );
}
