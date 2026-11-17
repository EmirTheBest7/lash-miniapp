import { useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Segmented, Switch } from '../ui/components';
import type { AdminBoot, AdminSettings, BroadcastInfo } from './types';

export function SettingsTab({ boot, toast, reloadBoot, onClientView }: { boot: AdminBoot; toast: (s: string) => void; reloadBoot: () => Promise<void>; onClientView: () => void }) {
  const [s, setS] = useState<AdminSettings>(boot.settings);
  async function save(patch: Partial<AdminSettings>) {
    const next = { ...s, ...patch };
    setS(next);
    const r = await api('admin/settings/save', patch, newOpId());
    if (!r.ok) { haptic.error(); setS(s); toast(t(r.error.code === 'bad_request' ? 'adm.bad_input' : 'err.network')); return; }
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
  return (
    <div class="page">
      <h1 class="large">{t('adm.tab_settings')}</h1>
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
        <Section title={t('adm.bc')} footer={t('adm.bc_note')}>
          <label class="field"><span>{t('adm.bc_text')}</span><textarea maxLength={1000} rows={4} value={text} onInput={(e) => { setText((e.target as HTMLTextAreaElement).value); setConfirmSend(false); }} /></label>
          <div class="note" data-testid="bc-audience">{bc ? t('adm.bc_audience', { n: bc.optin, total: bc.clients }) : '…'}</div>
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
