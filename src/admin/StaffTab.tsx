import { useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Switch } from '../ui/components';
import { Icon } from '../ui/Icon';
import { PALETTE, colorOf } from './Calendar';
import type { AdminBoot, StaffRow } from './types';

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const weekday = (n: number): string => new Intl.DateTimeFormat(document.documentElement.lang || 'en', { weekday: 'long' }).format(new Date(2024, 0, n));   // 2024-01-01 is a Monday
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function summary(s: StaffRow): string {
  const days = DAYS.filter((d) => (s.weekly[String(d)] ?? []).length > 0);
  if (days.length === 0) return t('adm.no_hours');
  const first = (s.weekly[String(days[0])] ?? []).map((i) => i.join('–')).join(', ');
  return `${days.length} ${t('adm.days')} · ${first}`;
}

export function StaffTab({ boot, toast, reloadBoot }: { boot: AdminBoot; toast: (s: string) => void; reloadBoot: () => Promise<void> }) {
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null);
  if (editing) return <Editor boot={boot} initial={editing === 'new' ? null : editing} toast={toast} onClose={async (changed) => { setEditing(null); if (changed) await reloadBoot(); }} />;
  return (
    <div class="page">
      <h1 class="large">{t('adm.tab_staff')}</h1>
      <Section footer={boot.staff.length > 1 || boot.can_manage ? t('adm.staff_note') : undefined}>
        {boot.staff.map((s, i) => (
          <Cell title={`${s.name || t('staff.default')}${s.mine ? ' · ' + t('adm.me') : ''}`} subtitle={s.active ? summary(s) : t('adm.inactive')} chevron
            after={<span class="dot" style={{ '--c': colorOf(s, i) }} />} onClick={() => setEditing(s)} />
        ))}
        {boot.can_manage && <Cell icon="plus" title={t('adm.add_staff')} chevron onClick={() => setEditing('new')} />}
      </Section>
    </div>
  );
}

function Editor({ boot, initial, toast, onClose }: { boot: AdminBoot; initial: StaffRow | null; toast: (s: string) => void; onClose: (changed: boolean) => void | Promise<void> }) {
  const own = boot.can_manage;
  const [name, setName] = useState(initial?.name ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [off, setOff] = useState<number[]>(initial?.off ?? []);
  const [me, setMe] = useState(initial?.mine ?? false);
  const [active, setActive] = useState(initial?.active ?? true);
  const [tgId, setTgId] = useState(initial?.tg_id && !initial.mine ? String(initial.tg_id) : '');
  const [weekly, setWeekly] = useState<Record<string, [string, string][]>>(initial ? JSON.parse(JSON.stringify(initial.weekly)) : JSON.parse(JSON.stringify(boot.staff[0]?.weekly ?? {})));
  const [busy, setBusy] = useState(false);
  const id = initial?.id;

  const setDay = (d: number, v: [string, string][]) => setWeekly((w) => ({ ...w, [String(d)]: v }));
  const err = (code: string, message?: string) => t(message === 'not_a_master' ? 'adm.not_a_master' : code === 'already_linked' ? 'adm.already_linked' : code === 'has_future' ? 'adm.has_future' : code === 'last_staff' ? 'adm.last_staff' : code === 'forbidden' ? 'err.forbidden' : code === 'bad_request' ? 'adm.bad_input' : 'err.network');

  async function save() {
    if (busy) return;
    setBusy(true);
    let sid = id;
    if (own) {
      const r = await api<{ id: number }>('admin/staff/save', {
        ...(id ? { id } : { copy_hours_from: boot.staff[0]?.id }), name: name.trim(), bio: bio.trim(), color, off,
        ...(me ? { link: 'self' } : /^\d{1,15}$/.test(tgId.trim()) ? { link: 'tg', tg_id: Number(tgId.trim()) } : { link: initial?.linked ? 'none' : 'keep' }),
      }, newOpId());
      if (!r.ok) { setBusy(false); haptic.error(); toast(err(r.error.code, r.error.message)); return; }
      sid = r.data.id;
      if (initial && active !== initial.active) {
        const a = await api('admin/staff/active', { id: sid, active }, newOpId());
        if (!a.ok) { setBusy(false); haptic.error(); toast(err(a.error.code)); return; }
      }
    }
    if (sid) {
      const h = await api('admin/hours/save', { staff: sid, weekly }, newOpId());
      if (!h.ok) { setBusy(false); haptic.error(); toast(err(h.error.code)); return; }
    }
    setBusy(false);
    haptic.success();
    toast(t('adm.saved'));
    await onClose(true);
  }

  return (
    <div class="page">
      <h1 class="large">{initial ? initial.name || t('staff.default') : t('adm.add_staff')}</h1>
      {own && (
        <>
          <Section title={t('adm.profile')}>
            <label class="field"><span>{t('adm.name')}</span><input value={name} maxLength={40} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
            <label class="field"><span>{t('adm.bio')}</span><textarea maxLength={200} value={bio} onInput={(e) => setBio((e.target as HTMLTextAreaElement).value)} /></label>
            <div class="swatches" role="group" aria-label={t('adm.color')}>
              {PALETTE.map((c) => <button class="swatch" style={{ '--c': c }} aria-label={c} aria-pressed={color === c} onClick={() => setColor(color === c ? '' : c)} />)}
            </div>
            <Cell title={t('adm.this_is_me')} after={<Switch label={t('adm.this_is_me')} checked={me} onChange={setMe} />} />
            {!me && <label class="field"><span>{t('adm.tg_id')}</span><input inputMode="numeric" value={tgId} maxLength={15} onInput={(e) => setTgId((e.target as HTMLInputElement).value)} /><div class="muted" style={{ fontSize: '13px', marginTop: '4px' }}>{t('adm.tg_note')}</div></label>}
            {initial && <Cell title={t('adm.active')} after={<Switch label={t('adm.active')} checked={active} onChange={setActive} />} />}
          </Section>
          <Section title={t('adm.does')} footer={t('adm.does_note')}>
            {boot.services.map((s) => (
              <Cell title={s.name} subtitle={s.is_addon ? t('adm.addon') : undefined}
                after={<Switch label={s.name} checked={!off.includes(s.id)} onChange={(on) => setOff((o) => (on ? o.filter((x) => x !== s.id) : [...o, s.id]))} />} />
            ))}
          </Section>
        </>
      )}
      <Section title={t('adm.hours')} footer={t('adm.hours_note')}>
        {DAYS.map((d) => {
          const iv = weekly[String(d)] ?? [];
          return (
            <div class="day-row" data-testid={`day-${d}`}>
              <div class="day-name"><span>{cap(weekday(d))}</span>
                <Switch label={cap(weekday(d))} checked={iv.length > 0} onChange={(on) => setDay(d, on ? [['10:00', '18:00']] : [])} />
              </div>
              {iv.map((p, i) => (
                <div class="ivl">
                  <input class="inline-input" type="time" step={300} aria-label={t('adm.from')} value={p[0]} onInput={(e) => setDay(d, iv.map((x, j) => (j === i ? [(e.target as HTMLInputElement).value, x[1]] : x)) as [string, string][])} />
                  <input class="inline-input" type="time" step={300} aria-label={t('adm.to')} value={p[1]} onInput={(e) => setDay(d, iv.map((x, j) => (j === i ? [x[0], (e.target as HTMLInputElement).value] : x)) as [string, string][])} />
                  <button class="x" aria-label={t('adm.remove')} onClick={() => setDay(d, iv.filter((_, j) => j !== i))}><Icon name="close" /></button>
                </div>
              ))}
              {iv.length > 0 && iv.length < 4 && <button class="link" onClick={() => setDay(d, [...iv, [iv[iv.length - 1]![1], '19:00']])}>{t('adm.add_interval')}</button>}
            </div>
          );
        })}
      </Section>
      <Button onClick={() => void save()} disabled={busy || (own && !initial && !name.trim())}>{busy ? '…' : t('adm.save')}</Button>
      <Button secondary onClick={() => void onClose(false)}>{t('short.cancel')}</Button>
    </div>
  );
}
