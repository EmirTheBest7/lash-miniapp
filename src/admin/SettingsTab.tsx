import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { useBack } from '../hooks';
import type { Screen, Tab } from './LaunchBox';
import { SettingsHome } from './SettingsHome';
import { AfterScreen, HelpScreen, MarketingScreen, RulesScreen, ScheduleScreen, SystemScreen } from './SettingsScreens';
import { StudioScreen } from './StudioScreen';
import type { AdminBoot, ViewAs } from './types';
import { useSettingsState, type Ctx } from './useSettings';

/** Settings = a home (progress card + category rows) and one screen per category. The native BackButton returns from a category. */
export function SettingsTab({ boot, toast, reloadBoot, onClientView, goTab, viewAs, setViewAs, realOwner }: {
  boot: AdminBoot; toast: (s: string) => void; reloadBoot: () => Promise<void>; onClientView: () => void; goTab: (t: Tab) => void; viewAs: ViewAs; setViewAs: (v: ViewAs) => void; realOwner: boolean;
}) {
  const [screen, setScreen] = useState<Screen | null>(null);
  const st = useSettingsState(boot, toast, reloadBoot);
  useBack(screen ? () => setScreen(null) : null);
  const c: Ctx = { boot, toast, reloadBoot, goTab, open: setScreen, onClientView, ...st, viewAs, setViewAs, realOwner };
  // the master view never reaches an admin / owner screen, whatever the state says
  const allowed = (sc: Screen): boolean => (sc === 'system' ? !!boot.is_owner : sc === 'help' || sc === 'after' || boot.can_manage);
  if (screen && allowed(screen)) {
    return (
      <>
        {screen === 'studio' && <StudioScreen c={c} />}
        {screen === 'schedule' && <ScheduleScreen c={c} />}
        {screen === 'rules' && <RulesScreen c={c} />}
        {screen === 'after' && <AfterScreen c={c} />}
        {screen === 'marketing' && <MarketingScreen c={c} />}
        {screen === 'system' && <SystemScreen c={c} />}
        {screen === 'help' && <HelpScreen c={c} />}
      </>
    );
  }
  return (
    <div class="page">
      <h1 class="large">{t('adm.tab_settings')}</h1>
      <SettingsHome c={c} />
    </div>
  );
}
