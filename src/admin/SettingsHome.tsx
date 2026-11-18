import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';
import { Button, Cell, Section, Sheet } from '../ui/components';
import type { IconName } from '../ui/Icon';
import { itemLabel, LaunchList, TECHNICAL } from './LaunchBox';
import type { Ctx } from './useSettings';

const czk = (n: number): string => `${n.toLocaleString('cs-CZ')} Kč`;

interface Row { id: string; icon: IconName; title: string; summary: string; attention?: boolean; go: () => void }

/** Settings home: the setup progress card (while incomplete) and the category rows. Nothing else. */
export function SettingsHome({ c }: { c: Ctx }) {
  const { boot, home } = c;
  const [list, setList] = useState(false);
  useEffect(() => { if (boot.can_manage) void c.reloadHome(); }, [boot.can_manage]);
  const s = c.s;
  const att = home?.attention ?? {};

  const rows: Row[] = [];
  if (boot.can_manage) {
    const mains = boot.services.filter((x) => !x.is_addon && x.active && !x.staff_only);       // a staff-only (test) service is not part of the studio's offer
    const prices = mains.map((x) => x.price).filter((p) => p > 0);
    const days = new Set(boot.staff.filter((x) => x.active).flatMap((x) => Object.keys(x.weekly))).size;
    const st = home?.studio;
    rows.push(
      { id: 'studio', icon: 'home', title: t('adm.s_studio'), attention: att.studio, go: () => c.open('studio'),
        summary: st ? [st.name || '–', st.area || t('adm.s_no_area'), st.address_set ? t('adm.s_mode_' + st.mode) : t('adm.s_no_address')].join(' · ') : '…' },
      { id: 'svc', icon: 'scissors', title: t('adm.tab_services'), attention: att.services, go: () => c.goTab('svc'),
        summary: prices.length ? (Math.min(...prices) === Math.max(...prices) ? t('adm.s_sum_services_one', { n: mains.length, p: czk(prices[0] ?? 0) }) : t('adm.s_sum_services', { n: mains.length, from: czk(Math.min(...prices)), to: czk(Math.max(...prices)) })) : t('adm.s_none_services') },
      { id: 'schedule', icon: 'clock', title: t('adm.s_schedule'), attention: att.schedule, go: () => c.open('schedule'), summary: t('adm.s_sum_schedule', { days, off: home?.days_off ?? 0 }) },
      { id: 'rules', icon: 'rules', title: t('adm.s_rules'), attention: att.rules, go: () => c.open('rules'),
        summary: t('adm.s_sum_rules', { h: s.cancel_cutoff_h, rem: t(s.rem1_on || s.rem2_on ? 'adm.s_on' : 'adm.s_off') }) },
      { id: 'after', icon: 'heart', title: t('adm.s_after'), go: () => c.open('after'),
        summary: t('adm.s_sum_after', { n: s.google_review_url ? 1 : 0, nudge: t(s.fill_nudge_on ? 'adm.s_on' : 'adm.s_off') }) },
      { id: 'marketing', icon: 'mail', title: t('adm.s_marketing'), attention: att.marketing, go: () => c.open('marketing'),
        summary: s.loyalty_enabled ? t('adm.s_sum_loyalty', { n: s.loyalty_visits, p: s.loyalty_percent }) : t('adm.s_sum_no_loyalty') },
    );
    if (boot.vouchers_on) rows.push({ id: 'vch', icon: 'gift', title: t('adm.tab_vouchers'), go: () => c.goTab('vch'), summary: home && home.vouchers.n > 0 ? t('adm.s_sum_vouchers', { n: home.vouchers.n, sum: czk(home.vouchers.sum) }) : t('adm.s_none_vouchers') });
    rows.push({ id: 'team', icon: 'team', title: t('adm.tab_staff'), attention: att.team, go: () => c.goTab('staff'), summary: t('adm.s_sum_team', { n: boot.staff.filter((x) => x.active).length }) });
  } else {
    rows.push(
      { id: 'schedule', icon: 'clock', title: t('adm.s_schedule'), go: () => c.goTab('staff'), summary: t('adm.s_sum_schedule_own') },
      { id: 'after', icon: 'heart', title: t('adm.s_after'), go: () => c.open('after'), summary: t('adm.s_sum_preview') },
    );
  }
  rows.push({ id: 'help', icon: 'help', title: t('adm.s_help'), go: () => c.open('help'), summary: t('adm.s_sum_help') });
  if (boot.is_owner) {
    rows.push({ id: 'system', icon: 'system', title: t('adm.s_system'), attention: att.system, go: () => c.open('system'),
      summary: home?.system ? t('adm.s_sum_system', { auto: t(home.system.automation ? 'adm.s_on' : 'adm.s_off'), backup: home.system.backup_h === null ? t('adm.s_no_backup') : t('adm.s_backup_ago', { h: home.system.backup_h }) }) : '…' });
  }

  // the count and the next step are for what THIS viewer can fix (a simulated administrator view hides keys and automation, like a real administrator)
  const visible = (home?.items ?? []).filter((i) => boot.is_owner || !TECHNICAL.includes(i.id));
  const req = visible.filter((i) => i.required);
  const order = ['studio', 'contact', 'address', 'service', 'aftercare', 'hours', 'policy', 'privacy', 'staff', 'secrets', 'automation'];
  const firstOpen = req.filter((i) => !i.ok).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))[0];
  const SCREEN: Record<string, string> = { studio: 'name', contact: 'contacts', address: 'place', service: 'services', aftercare: 'services', hours: 'schedule', policy: 'policy', privacy: 'privacy', staff: 'team', secrets: 'system', automation: 'system' };
  const p = home ? { done: req.filter((i) => i.ok).length, total: req.length } : undefined;
  const nextItem = firstOpen ? { id: firstOpen.id, screen: SCREEN[firstOpen.id] ?? 'name' } : null;
  return (
    <>
      {boot.can_manage && p && p.done < p.total && (
        <div class="pcard" data-testid="setup-card">
          <div class="p-top"><span class="p-title">{t('adm.s_card_title')}</span><span class="p-count">{t('adm.s_card_count', { done: p.done, total: p.total })}</span></div>
          <div class="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done}><i style={{ width: `${Math.round((p.done / Math.max(1, p.total)) * 100)}%` }} /></div>
          {nextItem && <div class="p-next">{t('adm.s_next', { item: itemLabel(nextItem.id) })}</div>}
          <Button onClick={() => c.openWizard()}>{t('adm.s_continue')}</Button>
          <button class="link" style={{ padding: '10px 0 0' }} onClick={() => setList(true)}>{t('adm.s_full_list')}</button>
          {home?.lang_hint && <div class="p-hint">{t('adm.s_lang_hint')}</div>}
        </div>
      )}
      {boot.can_manage && p && p.done >= p.total && (
        <Section>
          <Cell title={t('adm.s_ready')} after="✅" chevron onClick={() => setList(true)} />
          {home?.lang_hint && <div class="note">{t('adm.s_lang_hint')}</div>}
        </Section>
      )}
      <Section>
        {rows.map((r) => (
          <Cell key={r.id} icon={r.icon} title={r.title} subtitle={r.summary} chevron after={r.attention ? <span class="attn" role="img" aria-label={t('adm.s_attention')} /> : undefined} onClick={r.go} />
        ))}
      </Section>
      <Sheet open={list} onClose={() => setList(false)} title={t('adm.s_full_list')}>
        {list && <LaunchList boot={boot} toast={c.toast} goTab={(x) => { setList(false); c.goTab(x); }} open={(x) => { setList(false); c.open(x); }} reloadBoot={c.reloadBoot} onChange={() => void c.reloadHome()} />}
      </Sheet>
    </>
  );
}
