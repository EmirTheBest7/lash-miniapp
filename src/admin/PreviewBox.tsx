import { useState } from 'preact/hooks';
import { api } from '../api';
import { getLang, t } from '../i18n';
import { haptic } from '../tg';
import { Button, Section } from '../ui/components';
import type { AdminBoot } from './types';

const LANGS: [string, string][] = [['cs', 'Čeština'], ['en', 'English'], ['ru', 'Русский'], ['uk', 'Українська']];

/** "Preview messages": the aftercare, fill-nudge and review-request messages for a service, in a chosen language, sent to the user's OWN chat. Nothing is booked or sent to a client. */
export function PreviewBox({ boot, toast, serviceId }: { boot: AdminBoot; toast: (s: string) => void; serviceId?: number }) {
  const mains = boot.services.filter((s) => !s.is_addon);
  const [svc, setSvc] = useState<number>(serviceId ?? mains[0]?.id ?? 0);
  const [lang, setLang] = useState<string>(getLang());
  const [busy, setBusy] = useState(false);
  async function send() {
    if (busy || !svc) return;
    setBusy(true);
    const r = await api<{ sent: number }>('admin/service/preview', { id: svc, lang });
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t(r.error.code === 'rate_limited' ? 'err.rate' : 'err.network')); return; }
    haptic.success(); toast(t('adm.preview_sent'));
  }
  return (
    <Section title={t('adm.preview')} footer={t('adm.preview_note')}>
      {serviceId === undefined && (
        <label class="field"><span>{t('vch.service')}</span>
          <select value={svc} onChange={(e) => setSvc(Number((e.target as HTMLSelectElement).value))}>{mains.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
      )}
      <label class="field"><span>{t('adm.preview_lang')}</span>
        <select value={lang} onChange={(e) => setLang((e.target as HTMLSelectElement).value)}>{LANGS.map(([l, n]) => <option value={l} key={l}>{n}</option>)}</select></label>
      <Button secondary onClick={() => void send()} disabled={busy || !svc}>{busy ? '…' : t('adm.preview_btn')}</Button>
    </Section>
  );
}
