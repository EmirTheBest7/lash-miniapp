import { useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import type { Screen, Tab } from './LaunchBox';
import type { AdminBoot, AdminSettings, SettingsHomeData, ViewAs } from './types';

/** Everything the Settings screens share: the settings row and its saver, the home facts, navigation, and the "view as" simulation. */
export interface Ctx {
  boot: AdminBoot; toast: (s: string) => void; reloadBoot: () => Promise<void>; goTab: (t: Tab) => void; open: (s: Screen | null) => void; openWizard: (start?: number) => void; onClientView: () => void;
  s: AdminSettings; save: (patch: Partial<AdminSettings>) => Promise<void>; home: SettingsHomeData | null; reloadHome: () => Promise<void>;
  viewAs: ViewAs; setViewAs: (v: ViewAs) => void; realOwner: boolean;
}

export function useSettingsState(boot: AdminBoot, toast: (s: string) => void, reloadBoot: () => Promise<void>) {
  const [s, setS] = useState<AdminSettings>(boot.settings);
  const [home, setHome] = useState<SettingsHomeData | null>(null);
  async function reloadHome() { const r = await api<SettingsHomeData>('admin/settings/home', {}); if (r.ok) setHome(r.data); }
  async function save(patch: Partial<AdminSettings>) {
    const next = { ...s, ...patch };
    setS(next);
    const r = await api<{ settings: AdminSettings }>('admin/settings/save', patch, newOpId());
    if (!r.ok) { haptic.error(); setS(s); toast(t(r.error.code === 'bad_request' ? 'adm.bad_input' : 'err.network')); return; }
    if (r.data?.settings) setS(r.data.settings);   // server-computed fields (the automatic first reminder, its warning) come back
    haptic.success(); toast(t('adm.saved')); await reloadBoot(); void reloadHome();
  }
  return { s, save, home, reloadHome };
}
