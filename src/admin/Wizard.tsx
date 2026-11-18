import { useEffect, useRef, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { useBack } from '../hooks';
import { haptic } from '../tg';
import { Button, Cell, Section, Switch } from '../ui/components';
import { LangTabs } from './LangTabs';
import { ReviewLinksEditor } from './ReviewLinks';
import { StudioScreen } from './StudioScreen';
import type { Lang4, LaunchData } from './types';
import type { Ctx } from './useSettings';

export const STEPS = ['name', 'contacts', 'place', 'services', 'schedule', 'policy', 'privacy', 'reviews', 'done'] as const;
type Step = (typeof STEPS)[number];
/** The setup-list item behind each step (a step is "done" when its item is green). */
const ITEM: Partial<Record<Step, string>> = { name: 'studio', contacts: 'contact', place: 'address', services: 'service', schedule: 'hours', policy: 'policy', privacy: 'privacy', reviews: 'review' };

/** "Basic setup": one step per screen, progress saved on the server, steps computed from the real data, re-runnable from Help. */
export function Wizard({ c, startAt }: { c: Ctx; startAt?: number }) {
  const { home, boot } = c;
  const items = Object.fromEntries((home?.items ?? []).map((i) => [i.id, i.ok]));
  const isDone = (st: Step): boolean => (ITEM[st] ? !!items[ITEM[st]!] : false);
  const saved = home?.wizard ?? { step: 0, skipped: [] };
  const [skipped, setSkipped] = useState<string[]>(saved.skipped);
  const first = STEPS.findIndex((s) => s !== 'done' && !isDone(s) && !saved.skipped.includes(s));
  const [i, setI] = useState<number>(startAt ?? (first >= 0 ? first : STEPS.length - 1));
  const step = STEPS[i] as Step;
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => { window.scrollTo(0, 0); }, [i]);
  async function go(n: number, nextSkipped = skipped) {
    const k = Math.max(0, Math.min(STEPS.length - 1, n));
    setI(k); setSkipped(nextSkipped);
    void api('admin/setup/save', { step: k, skipped: nextSkipped }, newOpId());
    void c.reloadHome();
  }
  const next = () => void go(i + 1, skipped.filter((s) => s !== step));
  const skip = () => void go(i + 1, [...skipped.filter((s) => s !== step), step]);
  const back = () => (i > 0 ? void go(i - 1) : c.open(null));
  useBack(back);

  return (
    <div class="page wizard" ref={topRef}>
      <div class="back-row"><button onClick={back}>{t('adm.w_back')}</button></div>
      <div class="p-top" style={{ padding: '0 16px' }}><span class="p-count">{t('adm.w_step', { n: i + 1, total: STEPS.length })}</span></div>
      <div class="pbar" style={{ margin: '8px 16px' }} role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1}><i style={{ width: `${Math.round(((i + 1) / STEPS.length) * 100)}%` }} /></div>
      <h1 class="large">{t('adm.w_t_' + step)}</h1>
      <div class="note">{t('adm.w_e_' + step)}</div>
      {isDone(step) && <div class="note" data-testid="wz-done">{t('adm.w_done_mark')}</div>}

      {step === 'name' && <StudioScreen c={c} part="name" onDone={next} />}
      {step === 'contacts' && <StudioScreen c={c} part="contacts" onDone={next} />}
      {step === 'place' && <StudioScreen c={c} part="place" onDone={next} />}
      {step === 'services' && <ServicesStep c={c} />}
      {step === 'schedule' && (
        <Section footer={t('adm.s_hours_note')}>
          <Cell title={t('adm.s_work_hours')} chevron onClick={() => c.goTab('staff')} />
          <Cell title={t('adm.s_days_off')} chevron onClick={() => c.goTab('cal')} />
        </Section>
      )}
      {step === 'policy' && <PolicyStep c={c} onDone={next} />}
      {step === 'privacy' && <PrivacyStep c={c} done={isDone('privacy')} />}
      {step === 'reviews' && <ReviewLinksEditor c={c} />}
      {step === 'done' && <DoneStep c={c} skipped={skipped} isDone={isDone} go={(k) => void go(k)} />}

      {step !== 'name' && step !== 'contacts' && step !== 'place' && step !== 'policy' && (
        <div class="section"><Button onClick={step === 'done' ? () => c.open(null) : next}>{t(step === 'done' ? 'adm.w_finish' : 'adm.w_next')}</Button></div>
      )}
      {step !== 'done' && <button class="link" onClick={skip}>{t('adm.w_skip')}</button>}
      <button class="link" onClick={() => c.open(null)}>{t('adm.w_exit')}</button>
      <span hidden>{boot.me.id}</span>
    </div>
  );
}

function ServicesStep({ c }: { c: Ctx }) {
  const mains = c.boot.services.filter((x) => !x.is_addon && x.active && !x.staff_only);
  return (
    <>
      <Section footer={t('adm.w_services_note')}>
        {mains.length === 0 && <Cell title={t('adm.s_none_services')} />}
        {mains.map((s) => <Cell key={s.id} title={s.name} subtitle={s.price > 0 ? `${s.price.toLocaleString('cs-CZ')} Kč` : t('adm.w_no_price')} />)}
        <Cell title={t('adm.w_open_services')} chevron onClick={() => c.goTab('svc')} />
      </Section>
    </>
  );
}

/** Cancellation: hours + the text in four languages. Saved with the step's Next. */
function PolicyStep({ c, onDone }: { c: Ctx; onDone: () => void }) {
  const { s, save } = c;
  const [pol, setPol] = useState<Record<Lang4, string> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<LaunchData>('admin/launch', {}).then((r) => { if (r.ok && r.data.studio) { const x = r.data.studio; setPol({ cs: x.cancel_policy_cs, ru: x.cancel_policy_ru, uk: x.cancel_policy_uk, en: x.cancel_policy_en }); } }); }, []);
  async function go() {
    if (!pol || busy) return;
    setBusy(true);
    const r = await api('admin/studio/save', { cancel_policy_cs: pol.cs, cancel_policy_ru: pol.ru, cancel_policy_uk: pol.uk, cancel_policy_en: pol.en }, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); c.toast(t(r.error.code === 'address_in_text' ? 'adm.s_addr_in_text' : 'adm.bad_input')); return; }
    haptic.success(); await c.reloadBoot(); onDone();
  }
  return (
    <>
      <Section footer={t('adm.s_cancel_note')}>
        <label class="field"><span>{t('adm.cutoff')}</span><input type="number" inputMode="numeric" min={0} key={String(s.cancel_cutoff_h)} defaultValue={s.cancel_cutoff_h} onChange={(e) => void save({ cancel_cutoff_h: Math.max(0, Math.round(Number((e.target as HTMLInputElement).value) || 0)) })} /></label>
        {pol && <LangTabs label={t('ln.f_policy')} values={pol} rows={4} max={500} canTranslate={!!c.home?.translate} toast={c.toast} onChange={(l, v) => setPol((p) => (p ? { ...p, [l]: v } : p))} />}
      </Section>
      <div class="section"><Button onClick={() => void go()} disabled={busy}>{busy ? '…' : t('adm.w_next')}</Button></div>
    </>
  );
}

/** The data notice: she reads it as clients see it, then ticks. NEVER ticked by the wizard itself. */
function PrivacyStep({ c, done }: { c: Ctx; done: boolean }) {
  const [on, setOn] = useState(done);
  useEffect(() => setOn(done), [done]);
  return (
    <Section footer={t('adm.s_privacy_note')}>
      <Cell title={t('adm.w_read_notice')} subtitle={t('adm.w_read_notice_sub')} chevron onClick={c.onClientView} />
      <Cell title={t('ln.privacy')} after={<Switch label={t('ln.privacy')} checked={on} onChange={(v) => { setOn(v); void c.save({ privacy_reviewed: v } as never); }} />} />
    </Section>
  );
}

function DoneStep({ c, skipped, isDone, go }: { c: Ctx; skipped: string[]; isDone: (s: Step) => boolean; go: (i: number) => void }) {
  return (
    <>
      <Section title={t('adm.w_summary')}>
        {STEPS.slice(0, -1).map((s, k) => (
          <Cell key={s} title={t('adm.w_t_' + s)} after={isDone(s) ? t('adm.w_done_mark') : skipped.includes(s) ? t('adm.w_skipped_mark') : t('adm.w_todo_mark')}
            chevron={!isDone(s)} onClick={isDone(s) ? undefined : () => go(k)} />
        ))}
      </Section>
      {c.boot.is_owner && (
        <Section title={t('adm.s_system')} footer={t('adm.w_auto_note')}>
          <Cell title={t('adm.auto')} after={<Switch label={t('adm.auto')} checked={c.s.automation_on} onChange={(on) => void c.save({ automation_enabled: on } as never)} />} />
        </Section>
      )}
    </>
  );
}
