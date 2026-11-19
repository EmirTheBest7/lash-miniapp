import { useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { getLang, t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Segmented } from '../ui/components';
import { Shell } from './Shell';
import type { AiState } from './types';
import type { Ctx } from './useSettings';

type Mode = 'off' | 'staff' | 'all';

/** V (the AI assistant), owner only: who it answers (off / staff / all), what gates it on the server, last-24 h health, and the owner's instruction with its versions. */
export function AiScreen({ c }: { c: Ctx }) {
  const [st, setSt] = useState<AiState | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [tpl, setTpl] = useState(false);                     // the editor shows the ready-to-edit template (NOT saved until she saves)
  const apply = (s: AiState) => { setSt(s); const tt = s.template[getLang() === 'ru' || getLang() === 'uk' ? 'ru' : 'cs']; setTpl(s.prompt.text === ''); setText(s.prompt.text === '' ? tt : s.prompt.text); };
  useEffect(() => { void api<AiState>('admin/ai/state', {}).then((r) => { if (r.ok) apply(r.data); }); }, []);
  if (!st) return <Shell title={t('adm.ai_title')} onBack={() => c.open(null)}>{null}</Shell>;
  const gate = !st.env.enabled ? t('adm.ai_gate_off') : !st.env.key ? t('adm.ai_gate_nokey') : null;

  async function setMode(m: Mode) {
    if (busy || !st || m === st.setting) return;
    if (m === 'all' && !confirmAll) { setConfirmAll(true); return; }
    setBusy(true); setConfirmAll(false);
    const r = await api<AiState>('admin/ai/mode', { mode: m }, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); c.toast(t('err.network')); return; }
    haptic.success(); setSt(r.data); c.toast(t('adm.saved')); void c.reloadHome();
  }
  async function savePrompt(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    const r = await api<AiState>('admin/ai/prompt', body, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); c.toast(t('adm.bad_input')); return; }
    haptic.success(); apply(r.data); c.toast(t('adm.saved'));
  }
  const s = st.stats;
  return (
    <Shell title={t('adm.ai_title')} onBack={() => c.open(null)}>
      {st.placeholders && <div class="banner" role="alert" data-testid="ai-placeholders"><span class="grow">{t('adm.ai_placeholders')}</span></div>}
      <Section title={t('adm.ai_mode')} footer={t('adm.ai_mode_note')}>
        <Segmented value={st.setting} onChange={(m) => void setMode(m)} options={[{ value: 'off', label: t('adm.ai_m_off') }, { value: 'staff', label: t('adm.ai_m_staff') }, { value: 'all', label: t('adm.ai_m_all') }]} />
        {confirmAll && <div class="note" role="alert">{t('adm.ai_confirm_all')}<div class="lt-actions" style={{ paddingTop: 8 }}><Button onClick={() => void setMode('all')}>{t('adm.ai_confirm_btn')}</Button><Button secondary onClick={() => setConfirmAll(false)}>{t('adm.s_tr_cancel')}</Button></div></div>}
      </Section>
      <Section title={t('adm.ai_status')} footer={gate ?? (st.mode !== st.setting ? t('adm.ai_gate_mismatch') : undefined)}>
        <Cell title={t('adm.ai_effective')} after={t('adm.ai_m_' + st.mode)} />
        <Cell title="AI_ENABLED" after={st.env.enabled ? '✅' : '❌'} />
        <Cell title="GEMINI_API_KEY" after={st.env.key ? '✅' : '❌'} />
        <Cell title={t('adm.ai_model')} after={st.env.model} />
        <Cell title="AI_TIMEOUT_S" after={st.env.timeout_s === null ? t('adm.ai_auto') : `${st.env.timeout_s} s`} />
      </Section>
      <Section title={t('adm.ai_health')} footer={t('adm.ai_health_note')}>
        <Cell title={t('adm.ai_calls')} after={`${s.ok} / ${s.calls}`} subtitle={Object.entries(s.codes).filter(([k]) => k !== 'ok').map(([k, v]) => `${k}: ${v}`).join(' · ') || undefined} />
        <Cell title={t('adm.ai_speed')} after={s.ok ? `${s.p50} / ${s.p95} ms` : '–'} />
        {Object.entries(s.replies).map(([k, v]) => <Cell key={k} title={t('adm.ai_path_' + k) === 'adm.ai_path_' + k ? k : t('adm.ai_path_' + k)} after={`${v.n} · ${Math.round(v.p50 / 1000)}–${Math.round(v.p95 / 1000)} s`} />)}
        <Cell title={t('adm.ai_today')} after={`${s.today} / ${st.env.daily_limit}`} subtitle={s.last_error ? t('adm.ai_last_error', { e: s.last_error }) : undefined} />
      </Section>
      <Section title={t('adm.ai_prompt')} footer={t('adm.ai_prompt_note', { n: text.length })}>
        {tpl && <div class="note" data-testid="ai-template">{t('adm.ai_tpl_note')}</div>}
        <label class="field"><span>{t('adm.ai_prompt_label')}</span><textarea rows={8} maxLength={8000} value={text} onInput={(e) => { setText((e.target as HTMLTextAreaElement).value); }} /></label>
        <div class="lt-actions"><Button secondary onClick={() => void savePrompt({ text })} disabled={busy || (!tpl && text === st.prompt.text)}>{t('adm.save')}</Button>
          {tpl && <Button secondary onClick={() => setText('')} disabled={busy}>{t('adm.ai_tpl_clear')}</Button>}</div>
      </Section>
      {st.prompt.versions.length > 1 && (
        <Section title={t('adm.ai_versions')} footer={t('adm.ai_versions_note')}>
          {st.prompt.versions.map((v) => (
            <Cell key={v.id} title={`#${v.id} · ${v.chars} ${t('adm.ai_chars')}`} subtitle={new Date(v.at * 1000).toLocaleString()} after={v.id === st.prompt.id ? t('adm.ai_current') : undefined}
              chevron={v.id !== st.prompt.id} onClick={v.id === st.prompt.id ? undefined : () => void savePrompt({ restore: v.id })} />
          ))}
        </Section>
      )}
    </Shell>
  );
}
