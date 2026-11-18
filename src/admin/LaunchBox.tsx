import { useCallback, useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Segmented, Sheet, Switch } from '../ui/components';
import type { AdminBoot, LaunchData, StudioInfo } from './types';

export type Tab = 'cal' | 'staff' | 'svc' | 'vch' | 'set';
const LABEL: Record<string, string> = {
  studio: 'ln.studio', address: 'ln.address', contact: 'ln.contact', service: 'ln.service', aftercare: 'ln.aftercare', hours: 'ln.hours', policy: 'ln.policy', privacy: 'ln.privacy',
  secrets: 'ln.secrets', automation: 'ln.automation', review: 'ln.review', ai: 'ln.ai', staff: 'ln.staff',
};
const POLICY: [keyof StudioInfo, string][] = [['cancel_policy_cs', 'CS'], ['cancel_policy_en', 'EN'], ['cancel_policy_ru', 'RU'], ['cancel_policy_uk', 'UK']];

/** The "ready to launch?" list at the top of Settings: each open item jumps to where it is fixed (a tab, the studio sheet, an inline switch, or the server instruction). */
export function LaunchBox({ boot, toast, goTab, reloadBoot }: { boot: AdminBoot; toast: (s: string) => void; goTab: (t: Tab) => void; reloadBoot: () => Promise<void> }) {
  const [d, setD] = useState<LaunchData | null>(null);
  const [studio, setStudio] = useState<StudioInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await api<LaunchData>('admin/launch', {}); if (r.ok) setD(r.data); }, []);
  useEffect(() => { void load(); }, [load]);
  if (!d) return null;

  async function toggle(key: 'privacy_reviewed' | 'automation_enabled', on: boolean) {
    const r = await api('admin/settings/save', { [key]: on }, newOpId());
    if (!r.ok) { haptic.error(); toast(t('err.network')); return; }
    haptic.success(); await load(); await reloadBoot();
  }
  async function saveStudio() {
    if (!studio || busy) return;
    setBusy(true);
    const r = await api<LaunchData>('admin/studio/save', { ...studio }, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t('adm.bad_input')); return; }
    haptic.success(); toast(t('adm.saved')); setD(r.data); setStudio(null); await reloadBoot();
  }
  function jump(where: string, id: string) {
    if (where === 'studio') { if (d!.can_manage) setStudio({ ...d!.studio }); else toast(t('ln.f_studio')); return; }
    if (where === 'svc') { if (boot.can_manage) goTab('svc'); else toast(t('ln.f_service')); return; }
    if (where === 'staff') { goTab('staff'); return; }
    if (where === 'set') { toast(t('ln.f_review')); return; }
    toast(t(id === 'secrets' ? 'ln.f_secrets' : 'ln.f_ai'));
  }
  const num = (v: string): number => Number(v.replace(',', '.')) || 0;
  return (
    <>
      <Section title={t('ln.title', { done: d.progress.done, total: d.progress.total })} footer={t(d.progress.done === d.progress.total ? 'ln.ready' : 'ln.notready')}>
        {d.items.map((i) => {
          const label = t(LABEL[i.id] ?? 'ln.staff') + (i.required ? '' : ' · ' + t('ln.optional'));
          if (i.id === 'privacy' && d.can_manage) return <Cell key={i.id} title={label} subtitle={!i.ok ? t('ln.f_privacy') : undefined} after={<Switch label={label} checked={i.ok} onChange={(on) => void toggle('privacy_reviewed', on)} />} />;
          if (i.id === 'automation' && d.can_manage) return <Cell key={i.id} title={label} subtitle={!i.ok ? t('ln.f_automation') : undefined} after={<Switch label={label} checked={i.ok} onChange={(on) => void toggle('automation_enabled', on)} />} />;
          return <Cell key={i.id} title={label} after={i.ok ? '✅' : i.required ? '❌' : '➖'} chevron={!i.ok} onClick={i.ok ? undefined : () => jump(i.where, i.id)} />;
        })}
        {d.can_manage && <Cell title={t('ln.studio_info')} chevron onClick={() => setStudio({ ...d.studio })} />}
      </Section>
      <Sheet open={studio !== null} onClose={() => setStudio(null)} title={t('ln.studio_info')}>
        {studio && (
          <>
            <label class="field"><span>{t('ln.f_name')}</span><input maxLength={60} value={studio.studio_name} onInput={(e) => setStudio({ ...studio, studio_name: (e.target as HTMLInputElement).value })} /></label>
            <label class="field"><span>{t('ln.f_address')}</span><input maxLength={200} value={studio.address} onInput={(e) => setStudio({ ...studio, address: (e.target as HTMLInputElement).value })} /></label>
            <div class="note">{t('ln.f_address_note')}</div>
            <label class="field"><span>{t('ln.f_area')}</span><input maxLength={80} value={studio.area_text} onInput={(e) => setStudio({ ...studio, area_text: (e.target as HTMLInputElement).value })} /></label>
            <div class="note">{t('ln.f_area_note')}</div>
            <Section title={t('ln.f_mode')}>
              <Segmented value={studio.address_mode} onChange={(v) => setStudio({ ...studio, address_mode: v })} options={[
                { value: 'after_approval', label: t('ln.m_after') }, { value: 'auto_confirmed', label: t('ln.m_auto') }, { value: 'manual', label: t('ln.m_manual') }]} />
              <Cell title={t('ln.f_newmanual')} after={<Switch label={t('ln.f_newmanual')} checked={studio.address_new_clients_manual} onChange={(on) => setStudio({ ...studio, address_new_clients_manual: on })} />} />
              <Segmented value={studio.address_release_timing} onChange={(v) => setStudio({ ...studio, address_release_timing: v })} options={[
                { value: 'day_before', label: t('ln.t_day') }, { value: 'on_release', label: t('ln.t_now') }]} />
            </Section>
            <div class="row2">
              <label class="field" style={{ padding: 0 }}><span>{t('ln.f_lat')}</span><input inputMode="decimal" value={String(studio.lat)} onInput={(e) => setStudio({ ...studio, lat: num((e.target as HTMLInputElement).value) })} /></label>
              <label class="field" style={{ padding: 0 }}><span>{t('ln.f_lon')}</span><input inputMode="decimal" value={String(studio.lon)} onInput={(e) => setStudio({ ...studio, lon: num((e.target as HTMLInputElement).value) })} /></label>
            </div>
            <div class="note">{t('ln.f_pin_note')}</div>
            <label class="field"><span>{t('ln.f_contact_name')}</span><input maxLength={60} value={studio.contact_name} onInput={(e) => setStudio({ ...studio, contact_name: (e.target as HTMLInputElement).value })} /></label>
            <label class="field"><span>{t('ln.f_username')}</span><input maxLength={33} placeholder="username" value={studio.contact_username} onInput={(e) => setStudio({ ...studio, contact_username: (e.target as HTMLInputElement).value })} /></label>
            <label class="field"><span>{t('ln.f_instagram')}</span><input maxLength={200} value={studio.instagram} onInput={(e) => setStudio({ ...studio, instagram: (e.target as HTMLInputElement).value })} /></label>
            <label class="field"><span>{t('ln.f_portfolio')}</span><input type="url" maxLength={300} placeholder="https://…" value={studio.portfolio_url} onInput={(e) => setStudio({ ...studio, portfolio_url: (e.target as HTMLInputElement).value })} /></label>
            <Section footer={t('ln.f_policy_note')}>
              {POLICY.map(([k, l]) => (
                <label class="field" key={k}><span>{t('ln.f_policy')} · {l}</span><textarea rows={3} maxLength={500} value={studio[k] as string} onInput={(e) => setStudio({ ...studio, [k]: (e.target as HTMLTextAreaElement).value })} /></label>
              ))}
            </Section>
            <Button onClick={() => void saveStudio()} disabled={busy}>{busy ? '…' : t('adm.save')}</Button>
          </>
        )}
      </Sheet>
    </>
  );
}
