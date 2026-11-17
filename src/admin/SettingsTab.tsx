import { useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Cell, Section, Segmented, Switch } from '../ui/components';
import type { AdminBoot, AdminSettings } from './types';

export function SettingsTab({ boot, toast, reloadBoot, onClientView }: { boot: AdminBoot; toast: (s: string) => void; reloadBoot: () => Promise<void>; onClientView: () => void }) {
  const [s, setS] = useState<AdminSettings>(boot.settings);
  async function save(patch: Partial<AdminSettings>) {
    const next = { ...s, ...patch };
    setS(next);
    const r = await api('admin/settings/save', patch, newOpId());
    if (!r.ok) { haptic.error(); setS(s); toast(t(r.error.code === 'bad_request' ? 'adm.bad_input' : 'err.network')); return; }
    haptic.success(); toast(t('adm.saved')); await reloadBoot();
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
      <Section footer={t('adm.client_view_note')}>
        <Cell icon="user" title={t('adm.client_view')} chevron onClick={onClientView} />
      </Section>
    </div>
  );
}
