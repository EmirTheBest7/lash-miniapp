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
import type { AdminBoot } from './types';
import './admin.css';

type Tab = 'cal' | 'staff' | 'svc' | 'vch' | 'set';

/** The staff app (owner and masters). A separate lazy chunk: clients never download it. */
export function AdminApp({ onClientView, initial }: { onClientView: () => void; initial?: AdminBoot }) {
  const [boot, setBoot] = useState<AdminBoot | null>(initial ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('cal');
  const [toastText, toast] = useToast();

  const load = useCallback(async () => {
    const r = await api<AdminBoot>('admin/bootstrap');
    if (!r.ok) { setErr(r.error.code); return; }
    setErr(null); setBoot(r.data);
    setTimeout(perfReport, 0);
  }, []);
  useEffect(() => { if (initial) setTimeout(perfReport, 0); else void load(); }, [load]);      // `initial` came with the ONE bootstrap call

  if (err) return <Empty title={t(err === 'forbidden' ? 'err.forbidden' : err.startsWith('auth_') ? 'err.auth' : 'err.network')} icon="info" action={<Button onClick={() => void load()}>{t('btn.retry')}</Button>} />;
  if (!boot) return <div class="page"><Skeleton lines={6} /></div>;
  const tabs: { value: Tab; label: string }[] = [
    { value: 'cal', label: t('adm.tab_calendar') }, { value: 'staff', label: t('adm.tab_staff') },
    ...(boot.can_manage ? [{ value: 'svc' as Tab, label: t('adm.tab_services') }] : []), ...(boot.vouchers_on ? [{ value: 'vch' as Tab, label: t('adm.tab_vouchers') }] : []), { value: 'set', label: t('adm.tab_settings') },
  ];
  return (
    <>
      <div class="adm-tabs"><Segmented options={tabs} value={tab} onChange={setTab} /></div>
      {tab === 'cal' && <Calendar boot={boot} toast={toast} reloadBoot={load} />}
      {tab === 'staff' && <StaffTab boot={boot} toast={toast} reloadBoot={load} />}
      {tab === 'svc' && <ServicesTab boot={boot} toast={toast} reloadBoot={load} />}
      {tab === 'vch' && <VouchersTab boot={boot} toast={toast} />}
      {tab === 'set' && <SettingsTab boot={boot} toast={toast} reloadBoot={load} onClientView={onClientView} goTab={setTab} />}
      <Toast text={toastText} />
    </>
  );
}
