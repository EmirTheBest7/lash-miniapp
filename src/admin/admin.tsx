import { useCallback, useEffect, useState } from 'preact/hooks';
import '../i18n/adminTexts';
import { api } from '../api';
import { perfReport } from '../perf';
import { useToast } from '../hooks';
import { t } from '../i18n';
import { Button, Empty, Segmented, Skeleton, Toast } from '../ui/components';
import { Calendar } from './Calendar';
import { ServicesTab } from './ServicesTab';
import { SettingsTab } from './SettingsTab';
import { StaffTab } from './StaffTab';
import { VouchersTab } from './VouchersTab';
import type { AdminBoot, ViewAs } from './types';
import './admin.css';

type Tab = 'cal' | 'staff' | 'svc' | 'vch' | 'set';

/** The staff app (owner and masters). A separate lazy chunk: clients never download it. */
export function AdminApp({ onClientView, initial }: { onClientView: () => void; initial?: AdminBoot }) {
  const [boot, setBoot] = useState<AdminBoot | null>(initial ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('cal');
  const [toastText, toast] = useToast();
  const [viewAs, setViewAs] = useState<ViewAs>('real');            // owner-only front-end simulation of the administrator / master screens (the server still enforces the real role)

  const load = useCallback(async () => {
    const r = await api<AdminBoot>('admin/bootstrap');
    if (!r.ok) { setErr(r.error.code); return; }
    setErr(null); setBoot(r.data);
    setTimeout(perfReport, 0);
  }, []);
  useEffect(() => { if (initial) setTimeout(perfReport, 0); else void load(); }, [load]);      // `initial` came with the ONE bootstrap call

  if (err) return <Empty title={t(err === 'forbidden' ? 'err.forbidden' : err.startsWith('auth_') ? 'err.auth' : 'err.network')} icon="info" action={<Button onClick={() => void load()}>{t('btn.retry')}</Button>} />;
  if (!boot) return <div class="page"><Skeleton lines={6} /></div>;
  const realOwner = !!boot.is_owner;
  const eff: AdminBoot = viewAs === 'real' ? boot : { ...boot, is_owner: false, can_manage: viewAs === 'admin', vouchers_on: viewAs === 'admin' && !!boot.vouchers_on };
  const tabs: { value: Tab; label: string }[] = [
    { value: 'cal', label: t('adm.tab_calendar') }, { value: 'staff', label: t('adm.tab_staff') },
    ...(eff.can_manage ? [{ value: 'svc' as Tab, label: t('adm.tab_services') }] : []), ...(eff.vouchers_on ? [{ value: 'vch' as Tab, label: t('adm.tab_vouchers') }] : []), { value: 'set', label: t('adm.tab_settings') },
  ];
  return (
    <>
      <div class="adm-tabs"><Segmented options={tabs} value={tab} onChange={setTab} /></div>
      {viewAs !== 'real' && <div class="viewas" data-testid="viewas"><span>{t(viewAs === 'admin' ? 'adm.s_viewing_admin' : 'adm.s_viewing_master')}</span><button class="link" style={{ padding: 0 }} onClick={() => { setViewAs('real'); setTab('set'); }}>{t('adm.s_viewas_exit')}</button></div>}
      {tab === 'cal' && <Calendar boot={eff} toast={toast} reloadBoot={load} />}
      {tab === 'staff' && <StaffTab boot={eff} toast={toast} reloadBoot={load} />}
      {tab === 'svc' && <ServicesTab boot={eff} toast={toast} reloadBoot={load} />}
      {tab === 'vch' && <VouchersTab boot={eff} toast={toast} />}
      {(tab === 'set') && <SettingsTab key={viewAs}  boot={eff} toast={toast} reloadBoot={load} onClientView={onClientView} goTab={setTab} viewAs={viewAs} setViewAs={setViewAs} realOwner={realOwner} />}
      <Toast text={toastText} />
    </>
  );
}
