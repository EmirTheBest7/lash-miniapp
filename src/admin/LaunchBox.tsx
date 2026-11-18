import { useCallback, useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Cell, Section, Switch } from '../ui/components';
import type { AdminBoot, LaunchData } from './types';

export type Tab = 'cal' | 'staff' | 'svc' | 'vch' | 'set';
export type Screen = 'studio' | 'schedule' | 'rules' | 'after' | 'marketing' | 'system' | 'help';
export const LABEL: Record<string, string> = {
  studio: 'ln.studio', address: 'ln.address', contact: 'ln.contact', service: 'ln.service', aftercare: 'ln.aftercare', hours: 'ln.hours', policy: 'ln.policy', privacy: 'ln.privacy',
  secrets: 'ln.secrets', automation: 'ln.automation', review: 'ln.review', ai: 'ln.ai', staff: 'ln.staff',
};

/** The full setup list (what /launch shows), for THIS viewer: each open item jumps to where it is fixed. Shown in a sheet from the progress card, and in System. */
export function LaunchList({ boot, toast, goTab, open, reloadBoot, onChange }: {
  boot: AdminBoot; toast: (s: string) => void; goTab: (t: Tab) => void; open: (s: Screen) => void; reloadBoot: () => Promise<void>; onChange?: () => void;
}) {
  const [d, setD] = useState<LaunchData | null>(null);
  const load = useCallback(async () => { const r = await api<LaunchData>('admin/launch', {}); if (r.ok) setD(r.data); }, []);
  useEffect(() => { void load(); }, [load]);
  if (!d) return null;
  async function toggle(key: 'privacy_reviewed' | 'automation_enabled', on: boolean) {
    const r = await api('admin/settings/save', { [key]: on }, newOpId());
    if (!r.ok) { haptic.error(); toast(t('err.network')); return; }
    haptic.success(); await load(); await reloadBoot(); onChange?.();
  }
  function jump(where: string, id: string) {
    if (where === 'studio') { open('studio'); return; }
    if (where === 'svc') { if (boot.can_manage) goTab('svc'); else toast(t('ln.f_service')); return; }
    if (where === 'staff') { goTab('staff'); return; }
    if (where === 'set') { open('after'); return; }
    toast(t(id === 'secrets' ? 'ln.f_secrets' : 'ln.f_ai'));
  }
  return (
    <Section title={t('ln.title', { done: d.progress.done, total: d.progress.total })} footer={t(d.progress.done === d.progress.total ? 'ln.ready' : 'ln.notready')}>
      {d.items.map((i) => {
        const label = t(LABEL[i.id] ?? 'ln.staff') + (i.required ? '' : ' · ' + t('ln.optional'));
        if (i.id === 'privacy' && d.can_manage) return <Cell key={i.id} title={label} subtitle={!i.ok ? t('ln.f_privacy') : undefined} after={<Switch label={label} checked={i.ok} onChange={(on) => void toggle('privacy_reviewed', on)} />} />;
        if (i.id === 'automation' && boot.is_owner) return <Cell key={i.id} title={label} subtitle={!i.ok ? t('ln.f_automation') : undefined} after={<Switch label={label} checked={i.ok} onChange={(on) => void toggle('automation_enabled', on)} />} />;
        return <Cell key={i.id} title={label} after={i.ok ? '✅' : i.required ? '❌' : '➖'} chevron={!i.ok} onClick={i.ok ? undefined : () => jump(i.where, i.id)} />;
      })}
    </Section>
  );
}
