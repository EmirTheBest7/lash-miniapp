import { useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Segmented, Switch } from '../ui/components';
import { LaunchList } from './LaunchBox';
import { LangTabs } from './LangTabs';
import { PreviewBox } from './PreviewBox';
import { ReviewLinksEditor } from './ReviewLinks';
import { Shell } from './Shell';
import type { AdminSettings, BroadcastInfo, Lang4, StudioInfo, ViewAs } from './types';
import type { Ctx } from './useSettings';

type NumKey = 'min_notice_h' | 'horizon_days' | 'cancel_cutoff_h';
type HourKey = 'rem1_h' | 'rem2_h' | 'rem_unanswered_h' | 'ad_min_days' | 'waitlist_min_notice_h' | 'autocomplete_h' | 'review_delay_h' | 'review_gap_days';
const clamp = (v: string, lo: number, hi: number, dflt: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || dflt)));

function fields(c: Ctx) {
  const { s, save } = c;
  const num = (key: NumKey, label: string) => (
    <label class="field"><span>{label}</span><input type="number" inputMode="numeric" min={0} key={String(s[key])} defaultValue={s[key]} onChange={(e) => void save({ [key]: Math.max(0, Math.round(Number((e.target as HTMLInputElement).value) || 0)) })} /></label>
  );
  const hours = (key: HourKey, label: string, lo: number, hi: number) => (
    <label class="field"><span>{label}</span><input type="number" inputMode="numeric" min={lo} max={hi} key={String(key === 'rem1_h' && s.rem1_auto ? 0 : s[key])} defaultValue={key === 'rem1_h' && s.rem1_auto ? 0 : s[key]} onChange={(e) => void save({ [key]: clamp((e.target as HTMLInputElement).value, lo, hi, lo) })} /></label>
  );
  return { num, hours };
}

/** Schedule: how times are offered. Working hours and days off live where they are edited (the team card and the calendar). */
export function ScheduleScreen({ c }: { c: Ctx }) {
  const { s, save, boot } = c;
  const { num } = fields(c);
  return (
    <Shell title={t('adm.s_schedule')} onBack={() => c.open(null)}>
      <Section footer={t('adm.s_hours_note')}>
        <Cell title={t('adm.s_work_hours')} chevron onClick={() => c.goTab('staff')} />
        <Cell title={t('adm.s_days_off')} subtitle={t('adm.s_days_off_sub')} chevron onClick={() => c.goTab('cal')} />
      </Section>
      <Section title={t('adm.step')} footer={t('adm.step_note')}>
        <Segmented options={[10, 15, 20, 30, 60].map((n) => ({ value: String(n), label: String(n) }))} value={String(s.slot_step_min)} onChange={(v) => void save({ slot_step_min: Number(v) })} />
      </Section>
      <Section title={t('adm.rules')}>
        {num('min_notice_h', t('adm.notice'))}
        {num('horizon_days', t('adm.horizon'))}
      </Section>
      <Section footer={t('adm.buffer_close_note')}>
        <Cell title={t('adm.buffer_close')} after={<Switch label={t('adm.buffer_close')} checked={!s.buffer_may_exceed_close} onChange={(on) => void save({ buffer_may_exceed_close: !on })} />} />
      </Section>
      {boot.staff.length === 0 && null}
    </Shell>
  );
}

/** Bookings and rules: cancellation (hours + the text in four languages), reminders to clients, the data notice, waitlist, the evening agenda. */
export function RulesScreen({ c }: { c: Ctx }) {
  const { s, save } = c;
  const { num, hours } = fields(c);
  const [pol, setPol] = useState<Record<Lang4, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [privacy, setPrivacy] = useState<boolean | null>(null);
  useEffect(() => {
    void api<{ studio: StudioInfo | null; items: { id: string; ok: boolean }[] }>('admin/launch', {}).then((r) => {
      if (r.ok && r.data.studio) { const st = r.data.studio; setPol({ cs: st.cancel_policy_cs, ru: st.cancel_policy_ru, uk: st.cancel_policy_uk, en: st.cancel_policy_en }); setPrivacy(!!r.data.items.find((i) => i.id === 'privacy')?.ok); }
    });
  }, []);
  async function savePolicy() {
    if (!pol || busy) return;
    setBusy(true);
    const r = await api('admin/studio/save', { cancel_policy_cs: pol.cs, cancel_policy_ru: pol.ru, cancel_policy_uk: pol.uk, cancel_policy_en: pol.en }, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); c.toast(t(r.error.code === 'address_in_text' ? 'adm.s_addr_in_text' : 'adm.bad_input')); return; }
    haptic.success(); c.toast(t('adm.saved')); await c.reloadBoot(); void c.reloadHome();
  }
  return (
    <Shell title={t('adm.s_rules')} onBack={() => c.open(null)}>
      <Section title={t('adm.s_cancel')} footer={t('adm.s_cancel_note')}>
        {num('cancel_cutoff_h', t('adm.cutoff'))}
        {pol && (
          <>
            <LangTabs label={t('ln.f_policy')} values={pol} rows={4} max={500} canTranslate={!!c.home?.translate} toast={c.toast} onChange={(l, v) => setPol((prev) => (prev ? { ...prev, [l]: v } : prev))} />
            <div class="lt-actions"><Button secondary onClick={() => void savePolicy()} disabled={busy}>{busy ? '…' : t('adm.save')}</Button></div>
          </>
        )}
      </Section>
      <Section title={t('adm.s_reminders')} footer={t('adm.rem_note')}>
        {!s.automation_on && <div class="note" data-testid="auto-off">{t('adm.auto_off')}</div>}
        <Cell title={t('adm.rem1')} after={<Switch label={t('adm.rem1')} checked={s.rem1_on} onChange={(on) => void save({ rem1_on: on })} />} />
        {s.rem1_on && hours('rem1_h', t('adm.rem1_h'), 0, 168)}
        {s.rem1_on && s.rem1_warn && <div class="note" data-testid="rem1-warn">{t('adm.rem1_warn')}</div>}
        <Cell title={t('adm.rem2')} after={<Switch label={t('adm.rem2')} checked={s.rem2_on} onChange={(on) => void save({ rem2_on: on })} />} />
        {s.rem2_on && hours('rem2_h', t('adm.rem2_h'), 1, 72)}
        <Cell title={t('adm.rem_un')} after={<Switch label={t('adm.rem_un')} checked={s.rem_unanswered_on} onChange={(on) => void save({ rem_unanswered_on: on })} />} />
        {s.rem_unanswered_on && hours('rem_unanswered_h', t('adm.rem_un_h'), 1, 72)}
        <Cell title={t('adm.agenda')} after={<Switch label={t('adm.agenda')} checked={s.agenda_on} onChange={(on) => void save({ agenda_on: on })} />} />
        {s.agenda_on && <Cell title={t('adm.agenda_empty')} after={<Switch label={t('adm.agenda_empty')} checked={s.agenda_empty} onChange={(on) => void save({ agenda_empty: on })} />} />}
        <Cell title={t('adm.waitlist')} after={<Switch label={t('adm.waitlist')} checked={s.waitlist_on} onChange={(on) => void save({ waitlist_on: on })} />} />
        {s.waitlist_on && hours('waitlist_min_notice_h', t('adm.wl_notice'), 0, 72)}
      </Section>
      {privacy !== null && (
        <Section title={t('adm.s_privacy')} footer={t('adm.s_privacy_note')}>
          <Cell title={t('ln.privacy')} after={<Switch label={t('ln.privacy')} checked={privacy} onChange={(on) => { setPrivacy(on); void save({ privacy_reviewed: on } as Partial<AdminSettings>); }} />} />
        </Section>
      )}
    </Shell>
  );
}

/** After the visit: aftercare is per service (Services); here the nudge, auto-complete, review link and the preview of every message. */
export function AfterScreen({ c }: { c: Ctx }) {
  const { s, save, boot } = c;
  const { hours } = fields(c);
  return (
    <Shell title={t('adm.s_after')} onBack={() => c.open(null)}>
      {boot.can_manage && (
        <Section title={t('adm.after')} footer={t('adm.after_note')}>
          <Cell title={t('adm.s_aftercare_svc')} subtitle={t('adm.s_aftercare_svc_sub')} chevron onClick={() => c.goTab('svc')} />
          <Cell title={t('adm.fill_nudge')} after={<Switch label={t('adm.fill_nudge')} checked={s.fill_nudge_on} onChange={(on) => void save({ fill_nudge_on: on })} />} />
          <Cell title={t('adm.autocomplete')} after={<Switch label={t('adm.autocomplete')} checked={s.autocomplete_on} onChange={(on) => void save({ autocomplete_on: on })} />} />
          {s.autocomplete_on && hours('autocomplete_h', t('adm.autocomplete_h'), 1, 72)}
          {(s.review_links ?? []).some((l) => l.enabled) && (
            <>
              {hours('review_delay_h', t('adm.review_delay'), 1, 168)}
              {hours('review_gap_days', t('adm.review_gap'), 30, 3650)}
            </>
          )}
        </Section>
      )}
      {boot.can_manage && (
        <>
          <div class="sec-title-lite">{t('adm.rv_title')}</div>
          <ReviewLinksEditor c={c} />
        </>
      )}
      <PreviewBox boot={boot} toast={c.toast} />
    </Shell>
  );
}

/** Marketing: loyalty, the ad frequency cap, and the broadcast composer. */
export function MarketingScreen({ c }: { c: Ctx }) {
  const { s, save, boot, toast } = c;
  const { hours } = fields(c);
  const [bc, setBc] = useState<BroadcastInfo | null>(null);
  const [text, setText] = useState('');
  const [confirmSend, setConfirmSend] = useState(false);
  const [bcBusy, setBcBusy] = useState(false);
  useEffect(() => { void api<BroadcastInfo>('admin/broadcast/info', {}).then((r) => { if (r.ok) setBc(r.data); }); }, []);
  async function decide(id: number, approve: boolean) {
    const r = await api('admin/loyalty/decide', { id, approve }, newOpId());
    if (!r.ok && r.status !== 409) { haptic.error(); toast(t('err.network')); return; }
    haptic.success(); toast(t(approve ? 'adm.loy_approved' : 'adm.loy_declined')); await c.reloadBoot(); void c.reloadHome();
  }
  async function sendAd(test: boolean) {
    if (bcBusy || text.trim().length < 3) return;
    if (!test && !confirmSend) { setConfirmSend(true); return; }
    setBcBusy(true);
    const r = await api<BroadcastInfo & { sent: number }>('admin/broadcast/send', { text: text.trim(), test, expect: bc?.optin ?? 0 }, newOpId());
    setBcBusy(false); setConfirmSend(false);
    if (!r.ok) {
      haptic.error();
      toast(t(r.error.code === 'address_in_text' ? 'adm.s_addr_in_text' : r.error.code === 'no_audience' ? 'adm.bc_none' : r.error.code === 'duplicate' ? 'adm.bc_dup' : r.error.code === 'too_many' ? 'adm.bc_many' : r.error.code === 'audience_changed' ? 'adm.bc_changed' : 'adm.bad_input'));
      const i = await api<BroadcastInfo>('admin/broadcast/info', {}); if (i.ok) setBc(i.data); return;
    }
    haptic.success(); toast(test ? t('adm.bc_test_sent') : t('adm.bc_sent', { n: r.data.sent })); setBc(r.data);
    if (!test) setText('');
  }
  return (
    <Shell title={t('adm.s_marketing')} onBack={() => c.open(null)}>
      <Section title={t('adm.loyalty')} footer={t('adm.loyalty_note')}>
        <Cell title={t('adm.loyalty_on')} after={<Switch label={t('adm.loyalty_on')} checked={s.loyalty_enabled} onChange={(on) => void save({ loyalty_enabled: on })} />} />
        {s.loyalty_enabled && (
          <>
            <label class="field"><span>{t('adm.loy_visits')}</span><input type="number" inputMode="numeric" min={2} max={50} key={String(s.loyalty_visits)} defaultValue={s.loyalty_visits} onChange={(e) => void save({ loyalty_visits: clamp((e.target as HTMLInputElement).value, 2, 50, 7) })} /></label>
            <label class="field"><span>{t('adm.loy_percent')}</span><input type="number" inputMode="numeric" min={1} max={90} key={String(s.loyalty_percent)} defaultValue={s.loyalty_percent} onChange={(e) => void save({ loyalty_percent: clamp((e.target as HTMLInputElement).value, 1, 90, 10) })} /></label>
          </>
        )}
      </Section>
      {boot.loyalty_pending.length > 0 && (
        <Section title={t('adm.loy_pending')}>
          {boot.loyalty_pending.map((p) => (
            <div key={p.id} data-testid={`loy-${p.id}`}>
              <Cell title={p.client} subtitle={t('adm.loy_offer', { p: p.percent })} />
              <div class="row2">
                <Button secondary onClick={() => void decide(p.id, true)}>{t('adm.approve')}</Button>
                <Button secondary onClick={() => void decide(p.id, false)}>{t('adm.decline')}</Button>
              </div>
            </div>
          ))}
        </Section>
      )}
      <Section title={t('adm.bc')} footer={t('adm.bc_note')}>
        <label class="field"><span>{t('adm.bc_text')}</span><textarea maxLength={1000} rows={4} value={text} onInput={(e) => { setText((e.target as HTMLTextAreaElement).value); setConfirmSend(false); }} /></label>
        <div class="note" data-testid="bc-audience">{bc ? t('adm.bc_audience', { n: bc.optin, total: bc.clients }) : '…'}{bc && bc.skipped ? ' ' + t('adm.bc_skipped', { n: bc.skipped, d: bc.min_days ?? 7 }) : ''}</div>
        <div class="row2">
          <Button secondary onClick={() => void sendAd(true)} disabled={bcBusy || text.trim().length < 3}>{t('adm.bc_test')}</Button>
          <Button onClick={() => void sendAd(false)} disabled={bcBusy || text.trim().length < 3 || !bc || bc.optin === 0}>{confirmSend ? t('adm.bc_confirm', { n: bc?.optin ?? 0 }) : t('adm.bc_send')}</Button>
        </div>
        {hours('ad_min_days', t('adm.ad_days'), 0, 365)}
      </Section>
    </Shell>
  );
}

/** System (owner only): the technical switches and the server status. Administrators and masters never see this screen. */
export function SystemScreen({ c }: { c: Ctx }) {
  const { s, save, home } = c;
  return (
    <Shell title={t('adm.s_system')} onBack={() => c.open(null)}>
      <Section title={t('adm.rem')} footer={t('adm.s_auto_note')}>
        <Cell title={t('adm.auto')} after={<Switch label={t('adm.auto')} checked={s.automation_on} onChange={(on) => void save({ automation_enabled: on } as Partial<AdminSettings>)} />} />
        {!s.automation_on && <div class="note" data-testid="auto-off">{t('adm.auto_off')}</div>}
        <Cell title={t('adm.backup')} after={<Switch label={t('adm.backup')} checked={s.backup_on} onChange={(on) => void save({ backup_on: on })} />} />
        {s.backup_on && (
          <div class="note" data-testid="backup-status">
            {!s.backup_key ? t('adm.backup_nokey') : s.backup_last ? t('adm.backup_last', { h: Math.floor((Date.now() / 1000 - s.backup_last) / 3600) }) : t('adm.backup_none')}
          </div>
        )}
      </Section>
      <Section title={t('adm.s_status')}>
        <Cell title={t('ln.secrets')} after={home?.system?.keys ? '✅' : '❌'} />
        <Cell title={t('adm.ai_title')} subtitle={t('adm.s_v_note2')} chevron onClick={() => c.open('ai')} />
      </Section>
      <LaunchList boot={c.boot} toast={c.toast} goTab={c.goTab} open={c.open} reloadBoot={c.reloadBoot} onChange={() => void c.reloadHome()} skip={['automation']} />
      <Section title={t('adm.s_viewas')} footer={t('adm.s_viewas_note')}>
        <Cell title={t('adm.s_viewas_admin')} chevron onClick={() => { c.setViewAs('admin'); c.open(null); }} />
        <Cell title={t('adm.s_viewas_master')} chevron onClick={() => { c.setViewAs('master'); c.open(null); }} />
      </Section>
    </Shell>
  );
}

export type { ViewAs };
