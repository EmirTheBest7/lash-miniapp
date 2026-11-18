import { useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { duration, money } from '../format';
import { t } from '../i18n';
import { confirmNative, haptic, openTelegramLink } from '../tg';
import { Cell, Chip, Section, Segmented, Sheet } from '../ui/components';
import { hhmm, minutesOf } from './time';
import type { AdmAppt, AdminBoot, MoveData } from './types';

/** One appointment: who, what, with whom; status actions, reassignment to another person, and "move" (tap-to-place in the calendar). */
export function ApptCard({ open, appt: a, boot, tz, onClose, toast, reload, onMove }: {
  open: boolean; appt: AdmAppt | null; boot: AdminBoot; tz: string; onClose: () => void; toast: (s: string) => void; reload: () => Promise<void>; onMove: (a: AdmAppt) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!a) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const cur = boot.staff.find((s) => s.id === a.staff_id);
  const others = boot.staff.filter((s) => s.active && s.id !== a.staff_id && !s.off.includes(a.service_id));

  async function act(action: 'confirm' | 'complete' | 'no_show' | 'cancel') {
    if (busy || !a) return;
    if (action === 'cancel' && !(await confirmNative(t('adm.cancel_confirm', { name: a.client.name })))) return;
    setBusy(true);
    const r = await api<{ outcome: string }>('admin/appointments/status', { id: a.id, revision: a.rev, action }, newOpId());
    setBusy(false);
    if (!r.ok) { toast(t(r.error.code === 'stale_revision' ? 'err.stale' : 'err.network')); await reload(); return; }
    haptic.success(); toast(r.data.outcome === 'ok' ? t('adm.saved') : t('err.generic')); onClose(); await reload();
  }

  async function sendAddress() {
    if (busy || !a) return;
    setBusy(true);
    const r = await api<{ result: string }>('admin/appointments/send-address', { id: a.id }, newOpId());
    setBusy(false);
    if (!r.ok) { toast(t('err.network')); return; }
    const k: Record<string, string> = { queued: 'adm.adr_sent_ok', already: 'adm.adr_already_sent', not_confirmed: 'adm.adr_need_confirm', no_address: 'adm.adr_no_address', unreachable: 'adm.adr_unreachable' };
    if (r.data.result === 'queued') haptic.success(); else haptic.warn();
    toast(t(k[r.data.result] ?? 'err.generic')); await reload();
  }

  async function setPolicy(policy: 'default' | 'always' | 'never') {
    if (busy || !a || policy === a.address_policy) return;
    setBusy(true);
    const r = await api('admin/clients/address-policy', { appt: a.id, policy }, newOpId());
    setBusy(false);
    if (!r.ok) { toast(t('err.network')); return; }
    haptic.success(); toast(t('adm.saved')); await reload();
  }

  async function reassign(staffId: number) {
    if (busy || !a) return;
    setBusy(true);
    const r = await api<MoveData>('admin/appointments/move', { id: a.id, revision: a.rev, start: a.start, staff: staffId }, newOpId());
    setBusy(false);
    if (!r.ok) { toast(t(r.error.code === 'stale_revision' ? 'err.stale' : 'err.network')); await reload(); return; }
    if (r.data.outcome === 'ok') { haptic.success(); toast(t('adm.reassigned')); onClose(); } else { haptic.warn(); toast(t('adm.not_free')); }
    await reload();
  }

  const holds = a.status === 'pending' || a.status === 'pending_deposit' || a.status === 'confirmed';
  return (
    <Sheet open={open} onClose={onClose} title={a.client.name}>
      <Section>
        <Cell title={`${hhmm(minutesOf(a.start, tz))}–${hhmm(minutesOf(a.end, tz))}`} subtitle={`${duration((a.end - a.start) / 60)}${a.buffer_min ? ' + ' + t('adm.buffer', { n: a.buffer_min }) : ''}`} after={t('st.' + a.status)} />
        <Cell title={a.service} subtitle={a.addons.map((x) => '+ ' + x).join(' · ') || undefined} after={money(a.price)} />
        {boot.staff.filter((s) => s.active).length > 1 && <Cell title={t('adm.staff')} after={`${cur?.name || t('staff.default')}${a.auto ? ' · ' + t('adm.auto') : ''}`} />}
        {a.client.phone && <Cell title={t('adm.phone')} after={a.client.phone} onClick={() => { void navigator.clipboard?.writeText(a.client.phone!); toast(t('adm.copied')); }} />}
        {a.client.username && <Cell icon="user" title={`@${a.client.username}`} chevron onClick={() => openTelegramLink(`https://t.me/${a.client.username}`)} />}
      </Section>
      {a.address !== 'none' && a.client.tg && (
        <Section title={t('adm.adr_title')} footer={t('adm.adr_footer')}>
          {a.status === 'confirmed' && a.address === 'held' && <Cell title={t('adm.adr_send')} chevron onClick={() => void sendAddress()} />}
          {a.address === 'sent' && <Cell title={t('adm.adr_sent')} after="✅" />}
          <Segmented value={a.address_policy} onChange={(v) => void setPolicy(v)} options={[
            { value: 'default', label: t('adm.adr_p_default') }, { value: 'always', label: t('adm.adr_p_always') }, { value: 'never', label: t('adm.adr_p_never') }]} />
        </Section>
      )}
      {holds && others.length > 0 && (
        <Section title={t('adm.assign_to')}>
          <div class="chips">{others.map((s) => <Chip label={s.name || t('staff.default')} onClick={() => void reassign(s.id)} />)}</div>
        </Section>
      )}
      {holds && (
        <Section>
          {(a.status === 'pending' || a.status === 'pending_deposit') && <Cell icon="check" title={t('adm.confirm')} onClick={() => void act('confirm')} />}
          <Cell icon="calendar" title={t('adm.move')} chevron onClick={() => onMove(a)} />
          {a.status === 'confirmed' && <Cell icon="check" title={t('adm.complete')} onClick={() => void act('complete')} />}
          {a.status === 'confirmed' && <Cell title={t('adm.no_show')} onClick={() => void act('no_show')} />}
          <Cell title={t('adm.cancel')} destructive onClick={() => void act('cancel')} />
        </Section>
      )}
    </Sheet>
  );
}
