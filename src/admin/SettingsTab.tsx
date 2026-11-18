import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';
import { useBack } from '../hooks';
import type { Screen, Tab } from './LaunchBox';
import { SettingsHome } from './SettingsHome';
import { HelpScreen } from './HelpScreen';
import { AfterScreen, MarketingScreen, RulesScreen, ScheduleScreen, SystemScreen } from './SettingsScreens';
import { StudioScreen } from './StudioScreen';
import { Wizard } from './Wizard';
import type { AdminBoot, ViewAs } from './types';
import { useSettingsState, type Ctx } from './useSettings';

/** Settings = a home (progress card + category rows) and one screen per category. The native BackButton returns from a category. */
export function SettingsTab({ boot, toast, reloadBoot, onClientView, goTab, viewAs, setViewAs, realOwner, initialGo }: {
  initialGo?: string; boot: AdminBoot; toast: (s: string) => void; reloadBoot: () => Promise<void>; onClientView: () => void; goTab: (t: Tab) => void; viewAs: ViewAs; setViewAs: (v: ViewAs) => void; realOwner: boolean;
}) {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [wizStart, setWizStart] = useState<number | undefined>(undefined);       // undefined = the first step that is neither done nor skipped; 0 = re-run from the start
  const st = useSettingsState(boot, toast, reloadBoot);
  useBack(screen ? () => setScreen(null) : null);
  useEffect(() => {                                                              // a deep link (#go=...) from /navod opens exactly that screen once
    if (!initialGo) return;
    if (initialGo === 'wizard' && boot.can_manage) { setWizStart(0); setScreen('wizard'); }
    else if (initialGo === 'studio' && boot.can_manage) setScreen('studio');
    else if (initialGo === 'rules' && boot.can_manage) setScreen('rules');
    else if (initialGo === 'preview') setScreen('after');
    else if (initialGo === 'help') setScreen('help');
  }, [initialGo]);
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);                       // a category opens at its top, whatever the scroll position was
  const c: Ctx = { boot, toast, reloadBoot, goTab, open: (sc) => { setWizStart(undefined); setScreen(sc); }, openWizard: (start) => { setWizStart(start); setScreen('wizard'); }, onClientView, ...st, viewAs, setViewAs, realOwner };
  // the master view never reaches an admin / owner screen, whatever the state says
  const allowed = (sc: Screen): boolean => (sc === 'system' ? !!boot.is_owner : sc === 'help' || sc === 'after' || boot.can_manage);
  if (screen === 'wizard' && boot.can_manage) return <Wizard c={c} startAt={wizStart} />;
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
