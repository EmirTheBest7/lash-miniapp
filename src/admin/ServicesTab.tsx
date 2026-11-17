import { useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { duration, money } from '../format';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Sheet, Switch } from '../ui/components';
import type { AdminBoot, SvcRow } from './types';

/** Duration, buffer, price and visibility per service. The buffer is reserved on the calendar but never shown to customers. */
export function ServicesTab({ boot, toast, reloadBoot }: { boot: AdminBoot; toast: (s: string) => void; reloadBoot: () => Promise<void> }) {
  const [edit, setEdit] = useState<SvcRow | null>(null);
  const [f, setF] = useState({ dur: 60, buf: 15, price: 0, from: false, active: true });
  const [busy, setBusy] = useState(false);
  const open = (s: SvcRow) => { setEdit(s); setF({ dur: s.duration_min, buf: s.buffer_min, price: s.price, from: s.price_from, active: s.active }); };
  const num = (v: string): number => Math.max(0, Math.round(Number(v) || 0));

  async function save() {
    if (!edit || busy) return;
    setBusy(true);
    const r = await api('admin/service/save', { id: edit.id, duration_min: f.dur, buffer_min: f.buf, price: f.price, price_from: f.from, active: f.active }, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t(r.error.code === 'bad_request' ? 'adm.bad_input' : 'err.network')); return; }
    haptic.success(); toast(t('adm.saved')); setEdit(null); await reloadBoot();
  }

  const group = (addon: boolean) => boot.services.filter((s) => s.is_addon === addon);
  const row = (s: SvcRow) => (
    <Cell title={s.name} subtitle={`${duration(s.duration_min)} + ${t('adm.buffer', { n: s.buffer_min })} · ${money(s.price, s.price_from)}`} after={s.active ? undefined : t('adm.inactive')} chevron onClick={() => open(s)} />
  );
  return (
    <div class="page">
      <h1 class="large">{t('adm.tab_services')}</h1>
      <Section footer={t('adm.svc_note')}>{group(false).map(row)}</Section>
      {group(true).length > 0 && <Section title={t('adm.addons')}>{group(true).map(row)}</Section>}
      <Sheet open={edit !== null} onClose={() => setEdit(null)} title={edit?.name}>
        <div class="row2">
          <label class="field" style={{ padding: 0 }}><span>{t('adm.duration')}</span><input type="number" inputMode="numeric" min={5} max={600} step={5} value={f.dur} onInput={(e) => setF({ ...f, dur: num((e.target as HTMLInputElement).value) })} /></label>
          <label class="field" style={{ padding: 0 }}><span>{t('adm.buffer_label')}</span><input type="number" inputMode="numeric" min={0} max={240} step={5} value={f.buf} onInput={(e) => setF({ ...f, buf: num((e.target as HTMLInputElement).value) })} /></label>
        </div>
        <div class="note" data-testid="reserved">{t('adm.reserved', { n: duration(f.dur + f.buf) })} · {t('adm.client_sees', { n: duration(f.dur) })}</div>
        <label class="field"><span>{t('adm.price')}</span><input type="number" inputMode="numeric" min={0} step={10} value={f.price} onInput={(e) => setF({ ...f, price: num((e.target as HTMLInputElement).value) })} /></label>
        <Section>
          <Cell title={t('adm.price_from')} after={<Switch label={t('adm.price_from')} checked={f.from} onChange={(v) => setF({ ...f, from: v })} />} />
          <Cell title={t('adm.active')} after={<Switch label={t('adm.active')} checked={f.active} onChange={(v) => setF({ ...f, active: v })} />} />
        </Section>
        <Button onClick={() => void save()} disabled={busy}>{busy ? '…' : t('adm.save')}</Button>
      </Sheet>
    </div>
  );
}
