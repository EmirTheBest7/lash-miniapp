import { useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Segmented, Switch } from '../ui/components';
import { LangTabs } from './LangTabs';
import { FieldErr, Shell } from './Shell';
import type { LaunchData, Lang4, StudioInfo } from './types';
import type { Ctx } from './useSettings';

/** Studio: name, contacts, where clients are received (public area per language, exact address, pin, who gets it and when). ONE Save. */
export function StudioScreen({ c }: { c: Ctx }) {
  const [f, setF] = useState<StudioInfo | null>(null);
  const [pin, setPin] = useState({ lat: '', lon: '' });          // raw text: a typed "50." must keep its dot
  const [err, setErr] = useState<{ code: string; field: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<LaunchData>('admin/launch', {}).then((r) => { if (r.ok && r.data.studio) { setF(r.data.studio); setPin({ lat: r.data.studio.lat === null ? '' : String(r.data.studio.lat), lon: r.data.studio.lon === null ? '' : String(r.data.studio.lon) }); } }); }, []);
  if (!f) return <Shell title={t('adm.s_studio')} onBack={() => c.open(null)}>{null}</Shell>;
  const set = (patch: Partial<StudioInfo>) => { setF((prev) => (prev ? { ...prev, ...patch } : prev)); setErr(null); };
  const text = (k: 'studio_name' | 'contact_name' | 'contact_username' | 'instagram' | 'portfolio_url' | 'address', label: string, max: number, extra: Record<string, string> = {}) => (
    <>
      <label class="field"><span>{label}</span><input maxLength={max} value={f[k]} onInput={(e) => set({ [k]: (e.target as HTMLInputElement).value } as Partial<StudioInfo>)} {...extra} /></label>
      <FieldErr show={err?.field === k} text={t(err?.code === 'address_in_text' ? 'adm.s_addr_in_text' : 'adm.s_err_field')} />
    </>
  );
  const areas: Record<Lang4, string> = { cs: f.area_text_cs, ru: f.area_text_ru, uk: f.area_text_uk, en: f.area_text_en };
  async function save() {
    if (!f || busy) return;
    const lat = pin.lat.trim().replace(',', '.'), lon = pin.lon.trim().replace(',', '.');
    if ((lat === '') !== (lon === '')) { setErr({ code: 'bad_request', field: 'pin' }); return; }
    const body: Record<string, unknown> = { ...f, lat: lat === '' ? null : Number(lat), lon: lon === '' ? null : Number(lon) };
    if (lat !== '' && (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)))) { setErr({ code: 'bad_request', field: 'pin' }); return; }
    setBusy(true);
    const r = await api('admin/studio/save', body, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); const field = r.error.message ?? ''; setErr({ code: r.error.code, field: field.startsWith('area_text') || field.startsWith('cancel_policy') ? 'area' : field === 'lat/lon' ? 'pin' : field }); c.toast(t(r.error.code === 'address_in_text' ? 'adm.s_addr_in_text' : 'adm.bad_input')); return; }
    haptic.success(); c.toast(t('adm.saved')); await c.reloadBoot(); void c.reloadHome(); c.open(null);
  }
  return (
    <Shell title={t('adm.s_studio')} onBack={() => c.open(null)}>
      <Section>
        {text('studio_name', t('ln.f_name'), 60)}
        {text('contact_name', t('ln.f_contact_name'), 60)}
        {text('contact_username', t('ln.f_username'), 33, { placeholder: 'username' })}
        {text('instagram', t('ln.f_instagram'), 200)}
        {text('portfolio_url', t('ln.f_portfolio'), 300, { type: 'url', placeholder: 'https://…' })}
      </Section>
      <Section title={t('adm.s_place')} footer={t('adm.s_place_note')}>
        <LangTabs label={t('adm.s_area')} values={areas} rows={2} max={80} canTranslate={!!c.home?.translate} toast={c.toast}
          onChange={(l, v) => set({ [`area_text_${l}`]: v } as Partial<StudioInfo>)} />
        <FieldErr show={err?.field === 'area'} text={t(err?.code === 'address_in_text' ? 'adm.s_addr_in_text' : 'adm.s_err_field')} />
        {text('address', t('ln.f_address'), 200)}
        <div class="note">{t('ln.f_address_note')} {t('adm.s_guard_note')}</div>
        <div class="row2">
          <label class="field" style={{ padding: 0 }}><span>{t('ln.f_lat')}</span><input inputMode="decimal" value={pin.lat} onInput={(e) => { setPin({ ...pin, lat: (e.target as HTMLInputElement).value }); setErr(null); }} /></label>
          <label class="field" style={{ padding: 0 }}><span>{t('ln.f_lon')}</span><input inputMode="decimal" value={pin.lon} onInput={(e) => { setPin({ ...pin, lon: (e.target as HTMLInputElement).value }); setErr(null); }} /></label>
        </div>
        <FieldErr show={err?.field === 'pin'} text={t('adm.s_err_pin')} />
        <div class="note">{t('ln.f_pin_note')}</div>
        {(pin.lat !== '' || pin.lon !== '') && <button class="link" onClick={() => setPin({ lat: '', lon: '' })}>{t('adm.s_pin_clear')}</button>}
      </Section>
      <Section title={t('ln.f_mode')} footer={t('adm.s_mode_note')}>
        <Segmented value={f.address_mode} onChange={(v) => set({ address_mode: v })} options={[
          { value: 'after_approval', label: t('ln.m_after') }, { value: 'auto_confirmed', label: t('ln.m_auto') }, { value: 'manual', label: t('ln.m_manual') }]} />
        <Cell title={t('ln.f_newmanual')} after={<Switch label={t('ln.f_newmanual')} checked={f.address_new_clients_manual} onChange={(on) => set({ address_new_clients_manual: on })} />} />
        <Segmented value={f.address_release_timing} onChange={(v) => set({ address_release_timing: v })} options={[{ value: 'day_before', label: t('ln.t_day') }, { value: 'on_release', label: t('ln.t_now') }]} />
      </Section>
      <div class="section"><Button onClick={() => void save()} disabled={busy}>{busy ? '…' : t('adm.save')}</Button></div>
    </Shell>
  );
}
