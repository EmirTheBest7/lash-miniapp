import { useCallback, useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Cell, Section, Switch } from '../ui/components';
import type { AdminBoot, LaunchData } from './types';

export type Tab = 'cal' | 'staff' | 'svc' | 'vch' | 'set';
export type Screen = 'studio' | 'schedule' | 'rules' | 'after' | 'marketing' | 'system' | 'help';
/** Plain wording for the setup items (no "placeholder", no technical words). */
export const itemLabel = (id: string): string => t('adm.s_item_' + id);
export const TECHNICAL = ['secrets', 'automation', 'ai'];

/** The full setup list (what /launch shows), for THIS viewer: each open item jumps to where it is fixed. Shown in a sheet from the progress card, and in System. */
export function LaunchList({ boot, toast, goTab, open, reloadBoot, onChange, skip = [] }: {
  skip?: string[]; boot: AdminBoot; toast: (s: string) => void; goTab: (t: Tab) => void; open: (s: Screen) => void; reloadBoot: () => Promise<void>; onChange?: () => void;
}) {
  const [d, setD] = useState<LaunchData | null>(null);
  const load = useCallback(async () => { const r = await api<LaunchData>('admin/launch', {}); if (r.ok) setD(r.data); }, []);
  useEffect(() => { void load(); }, [load]);
  if (!d) return null;
  // a simulated administrator view hides the technical lines too (the server already does for a real one)
  const shown = d.items.filter((i) => !skip.includes(i.id) && (boot.is_owner || !TECHNICAL.includes(i.id)));
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
    <Section title={t('adm.s_list_title', { done: shown.filter((i) => i.required && i.ok).length, total: shown.filter((i) => i.required).length })} footer={t(shown.every((i) => !i.required || i.ok) ? 'ln.ready' : 'ln.notready')}>
      {shown.map((i) => {
        const label = itemLabel(i.id) + (i.required ? '' : ' · ' + t('ln.optional'));
        if (i.id === 'privacy' && d.can_manage) return <Cell key={i.id} title={label} subtitle={!i.ok ? t('ln.f_privacy') : undefined} after={<Switch label={label} checked={i.ok} onChange={(on) => void toggle('privacy_reviewed', on)} />} />;
        if (i.id === 'automation' && boot.is_owner) return <Cell key={i.id} title={label} subtitle={!i.ok ? t('ln.f_automation') : undefined} after={<Switch label={label} checked={i.ok} onChange={(on) => void toggle('automation_enabled', on)} />} />;
        return <Cell key={i.id} title={label} after={i.ok ? '✅' : i.required ? '❌' : '➖'} chevron={!i.ok} onClick={i.ok ? undefined : () => jump(i.where, i.id)} />;
      })}
    </Section>
  );
}
