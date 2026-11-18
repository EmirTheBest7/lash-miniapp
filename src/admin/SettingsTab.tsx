import { useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Segmented, Switch } from '../ui/components';
import { LaunchBox, type Tab } from './LaunchBox';
import { PreviewBox } from './PreviewBox';
import type { AdminBoot, AdminSettings, BroadcastInfo } from './types';

export function SettingsTab({ boot, toast, reloadBoot, onClientView, goTab }: { boot: AdminBoot; toast: (s: string) => void; reloadBoot: () => Promise<void>; onClientView: () => void; goTab: (t: Tab) => void }) {
  const [s, setS] = useState<AdminSettings>(boot.settings);
  async function save(patch: Partial<AdminSettings>) {
    const next = { ...s, ...patch };
    setS(next);
    const r = await api<{ settings: AdminSettings }>('admin/settings/save', patch, newOpId());
    if (!r.ok) { haptic.error(); setS(s); toast(t(r.error.code === 'bad_request' ? 'adm.bad_input' : 'err.network')); return; }
    if (r.data?.settings) setS(r.data.settings);   // server-computed fields (the automatic first reminder, its warning) come back
    haptic.success(); toast(t('adm.saved')); await reloadBoot();
  }
  async function decide(id: number, approve: boolean) {
    const r = await api('admin/loyalty/decide', { id, approve }, newOpId());
    if (!r.ok && r.status !== 409) { haptic.error(); toast(t('err.network')); return; }
    haptic.success(); toast(t(approve ? 'adm.loy_approved' : 'adm.loy_declined')); await reloadBoot();
  }
  const [bc, setBc] = useState<BroadcastInfo | null>(null);
  const [text, setText] = useState('');
  const [confirmSend, setConfirmSend] = useState(false);
  const [bcBusy, setBcBusy] = useState(false);
  useEffect(() => { if (boot.can_manage) void api<BroadcastInfo>('admin/broadcast/info', {}).then((r) => { if (r.ok) setBc(r.data); }); }, []);
  async function sendAd(test: boolean) {
    if (bcBusy || text.trim().length < 3) return;
    if (!test && !confirmSend) { setConfirmSend(true); return; }
    setBcBusy(true);
    const r = await api<BroadcastInfo & { sent: number }>('admin/broadcast/send', { text: text.trim(), test, expect: bc?.optin ?? 0 }, newOpId());
    setBcBusy(false); setConfirmSend(false);
    if (!r.ok) { haptic.error(); toast(t(r.error.code === 'no_audience' ? 'adm.bc_none' : r.error.code === 'duplicate' ? 'adm.bc_dup' : r.error.code === 'too_many' ? 'adm.bc_many' : r.error.code === 'audience_changed' ? 'adm.bc_changed' : 'adm.bad_input')); const i = await api<BroadcastInfo>('admin/broadcast/info', {}); if (i.ok) setBc(i.data); return; }
    haptic.success(); toast(test ? t('adm.bc_test_sent') : t('adm.bc_sent', { n: r.data.sent })); setBc(r.data);
    if (!test) setText('');
  }
  const numField = (key: 'min_notice_h' | 'horizon_days' | 'cancel_cutoff_h', label: string) => (
    <label class="field"><span>{label}</span><input type="number" inputMode="numeric" min={0} value={s[key]} onChange={(e) => void save({ [key]: Math.max(0, Math.round(Number((e.target as HTMLInputElement).value) || 0)) })} /></label>
  );
  const hoursField = (key: 'rem1_h' | 'rem2_h' | 'rem_unanswered_h' | 'ad_min_days' | 'waitlist_min_notice_h', label: string, lo: number, hi: number) => (
    <label class="field"><span>{label}</span><input type="number" inputMode="numeric" min={lo} max={hi} value={key === 'rem1_h' && s.rem1_auto ? 0 : s[key]} onChange={(e) => void save({ [key]: Math.min(hi, Math.max(lo, Math.round(Number((e.target as HTMLInputElement).value) || 0))) })} /></label>
  );
  return (
    <div class="page">
      <h1 class="large">{t('adm.tab_settings')}</h1>
      <LaunchBox boot={boot} toast={toast} goTab={goTab} reloadBoot={reloadBoot} />
      {boot.can_manage && (
        <>
          <Section title={t('adm.step')} footer={t('adm.step_note')}>
            <Segmented options={[10, 15, 20, 30, 60].map((n) => ({ value: String(n), label: String(n) }))} value={String(s.slot_step_min)} onChange={(v) => void save({ slot_step_min: Number(v) })} />
          </Section>
          <Section title={t('adm.rules')}>
            {numField('min_notice_h', t('adm.notice'))}
            {numField('horizon_days', t('adm.horizon'))}
            {numField('cancel_cutoff_h', t('adm.cutoff'))}
          </Section>
          <Section footer={t('adm.buffer_close_note')}>
            <Cell title={t('adm.buffer_close')} after={<Switch label={t('adm.buffer_close')} checked={!s.buffer_may_exceed_close} onChange={(on) => void save({ buffer_may_exceed_close: !on })} />} />
          </Section>
        </>
      )}
      {boot.can_manage && (
        <>
          <Section title={t('adm.loyalty')} footer={t('adm.loyalty_note')}>
            <Cell title={t('adm.loyalty_on')} after={<Switch label={t('adm.loyalty_on')} checked={s.loyalty_enabled} onChange={(on) => void save({ loyalty_enabled: on })} />} />
            {s.loyalty_enabled && (
              <>
                <label class="field"><span>{t('adm.loy_visits')}</span><input type="number" inputMode="numeric" min={2} max={50} value={s.loyalty_visits} onChange={(e) => void save({ loyalty_visits: Math.min(50, Math.max(2, Math.round(Number((e.target as HTMLInputElement).value) || 7))) })} /></label>
                <label class="field"><span>{t('adm.loy_percent')}</span><input type="number" inputMode="numeric" min={1} max={90} value={s.loyalty_percent} onChange={(e) => void save({ loyalty_percent: Math.min(90, Math.max(1, Math.round(Number((e.target as HTMLInputElement).value) || 10))) })} /></label>
              </>
            )}
          </Section>
          {boot.loyalty_pending.length > 0 && (
            <Section title={t('adm.loy_pending')}>
              {boot.loyalty_pending.map((p) => (
                <div key={p.id} data-testid={`loy-${p.id}`}>
                  <Cell title={p.client} subtitle={t('adm.loy_offer', { p: p.percent })} />
                  <div class="row2">
                    <Button onClick={() => void decide(p.id, true)}>{t('adm.approve')}</Button>
                    <Button secondary onClick={() => void decide(p.id, false)}>{t('adm.decline')}</Button>
                  </div>
                </div>
              ))}
            </Section>
          )}
        </>
      )}
      {boot.can_manage && (
        <Section title={t('adm.rem')} footer={t('adm.rem_note')}>
          <Cell title={t('adm.auto')} after={<Switch label={t('adm.auto')} checked={s.automation_on} onChange={(on) => void save({ automation_enabled: on } as Partial<AdminSettings>)} />} />
          {!s.automation_on && <div class="note" data-testid="auto-off">{t('adm.auto_off')}</div>}
          <Cell title={t('adm.rem1')} after={<Switch label={t('adm.rem1')} checked={s.rem1_on} onChange={(on) => void save({ rem1_on: on })} />} />
          {s.rem1_on && hoursField('rem1_h', t('adm.rem1_h'), 0, 168)}
          {s.rem1_on && s.rem1_warn && <div class="note" data-testid="rem1-warn">{t('adm.rem1_warn')}</div>}
          <Cell title={t('adm.rem2')} after={<Switch label={t('adm.rem2')} checked={s.rem2_on} onChange={(on) => void save({ rem2_on: on })} />} />
          {s.rem2_on && hoursField('rem2_h', t('adm.rem2_h'), 1, 72)}
          <Cell title={t('adm.rem_un')} after={<Switch label={t('adm.rem_un')} checked={s.rem_unanswered_on} onChange={(on) => void save({ rem_unanswered_on: on })} />} />
          {s.rem_unanswered_on && hoursField('rem_unanswered_h', t('adm.rem_un_h'), 1, 72)}
          <Cell title={t('adm.agenda')} after={<Switch label={t('adm.agenda')} checked={s.agenda_on} onChange={(on) => void save({ agenda_on: on })} />} />
          {s.agenda_on && <Cell title={t('adm.agenda_empty')} after={<Switch label={t('adm.agenda_empty')} checked={s.agenda_empty} onChange={(on) => void save({ agenda_empty: on })} />} />}
          <Cell title={t('adm.waitlist')} after={<Switch label={t('adm.waitlist')} checked={s.waitlist_on} onChange={(on) => void save({ waitlist_on: on })} />} />
          <Cell title={t('adm.backup')} after={<Switch label={t('adm.backup')} checked={s.backup_on} onChange={(on) => void save({ backup_on: on })} />} />
          {s.backup_on && (
            <div class="note" data-testid="backup-status">
              {!s.backup_key ? t('adm.backup_nokey') : s.backup_last ? t('adm.backup_last', { h: Math.floor((Date.now() / 1000 - s.backup_last) / 3600) }) : t('adm.backup_none')}
            </div>
          )}
          {s.waitlist_on && hoursField('waitlist_min_notice_h', t('adm.wl_notice'), 0, 72)}
          {hoursField('ad_min_days', t('adm.ad_days'), 0, 365)}
        </Section>
      )}
      {boot.can_manage && (
        <Section title={t('adm.after')} footer={t('adm.after_note')}>
          <Cell title={t('adm.fill_nudge')} after={<Switch label={t('adm.fill_nudge')} checked={s.fill_nudge_on} onChange={(on) => void save({ fill_nudge_on: on })} />} />
          <Cell title={t('adm.autocomplete')} after={<Switch label={t('adm.autocomplete')} checked={s.autocomplete_on} onChange={(on) => void save({ autocomplete_on: on })} />} />
          {s.autocomplete_on && <label class="field"><span>{t('adm.autocomplete_h')}</span><input type="number" inputMode="numeric" min={1} max={72} value={s.autocomplete_h} onChange={(e) => void save({ autocomplete_h: Math.min(72, Math.max(1, Math.round(Number((e.target as HTMLInputElement).value) || 1))) })} /></label>}
          <label class="field"><span>{t('adm.review_url')}</span><input type="url" inputMode="url" placeholder="https://…" maxLength={500} value={s.google_review_url} onChange={(e) => void save({ google_review_url: (e.target as HTMLInputElement).value.trim() })} /></label>
          {s.google_review_url !== '' && (
            <>
              <label class="field"><span>{t('adm.review_delay')}</span><input type="number" inputMode="numeric" min={1} max={168} value={s.review_delay_h} onChange={(e) => void save({ review_delay_h: Math.min(168, Math.max(1, Math.round(Number((e.target as HTMLInputElement).value) || 1))) })} /></label>
              <label class="field"><span>{t('adm.review_gap')}</span><input type="number" inputMode="numeric" min={30} max={3650} value={s.review_gap_days} onChange={(e) => void save({ review_gap_days: Math.min(3650, Math.max(30, Math.round(Number((e.target as HTMLInputElement).value) || 30))) })} /></label>
            </>
          )}
        </Section>
      )}
      <PreviewBox boot={boot} toast={toast} />
      {boot.can_manage && (
        <Section title={t('adm.bc')} footer={t('adm.bc_note')}>
          <label class="field"><span>{t('adm.bc_text')}</span><textarea maxLength={1000} rows={4} value={text} onInput={(e) => { setText((e.target as HTMLTextAreaElement).value); setConfirmSend(false); }} /></label>
          <div class="note" data-testid="bc-audience">{bc ? t('adm.bc_audience', { n: bc.optin, total: bc.clients }) : '…'}{bc && bc.skipped ? ' ' + t('adm.bc_skipped', { n: bc.skipped, d: bc.min_days ?? 7 }) : ''}</div>
          <div class="row2">
            <Button secondary onClick={() => void sendAd(true)} disabled={bcBusy || text.trim().length < 3}>{t('adm.bc_test')}</Button>
            <Button onClick={() => void sendAd(false)} disabled={bcBusy || text.trim().length < 3 || !bc || bc.optin === 0}>{confirmSend ? t('adm.bc_confirm', { n: bc?.optin ?? 0 }) : t('adm.bc_send')}</Button>
          </div>
        </Section>
      )}
      <Section footer={t('adm.client_view_note')}>
        <Cell icon="user" title={t('adm.client_view')} chevron onClick={onClientView} />
      </Section>
    </div>
  );
}
