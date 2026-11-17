import { useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { dayLong } from '../format';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Sheet } from '../ui/components';
import { hhmm, minutesOf, parseHm, toUtc } from './time';
import type { AdminBoot, CalData } from './types';

/** One person's day: day off, special hours, back to the weekly template, blocked time. (Owner: also the whole studio.) */
export function DaySheet({ open, boot, tz, date, staffId, cal, onClose, toast, reload }: {
  open: boolean; boot: AdminBoot; tz: string; date: string; staffId: number; cal: CalData | null; onClose: () => void; toast: (s: string) => void; reload: () => Promise<void>;
}) {
  const [hours, setHours] = useState({ from: '10:00', to: '18:00' });
  const [blk, setBlk] = useState({ from: '12:00', to: '13:00', reason: '' });
  // reset when the sheet CLOSES (resetting on open would wipe what is typed in the first moments)
  useEffect(() => { if (!open) { setHours({ from: '10:00', to: '18:00' }); setBlk({ from: '12:00', to: '13:00', reason: '' }); } }, [open]);
  const who = boot.staff.find((s) => s.id === staffId);
  const ov = cal?.overrides.find((o) => o.staff_id === staffId && o.date === date);
  const blocks = (cal?.blocks ?? []).filter((b) => b.staff_id === staffId);

  async function call(route: string, data: Record<string, unknown>, msg: string) {
    const r = await api<{ overlaps?: number }>(route, data, newOpId());
    if (!r.ok) { toast(t(r.error.code === 'forbidden' ? 'err.forbidden' : r.error.code === 'bad_request' ? 'adm.bad_input' : 'err.network')); return; }
    haptic.success();
    toast(r.data.overlaps ? t('adm.overlaps', { n: r.data.overlaps }) : msg);
    await reload();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`${who?.name || t('staff.default')} · ${dayLong(date)}`}>
      {ov && <div class="note">{ov.closed ? t('adm.day_off_now') : t('adm.special_now', { h: ov.intervals.map((i) => i.join('–')).join(', ') })}</div>}
      <Section>
        <Cell title={t('adm.day_off')} onClick={() => void call('admin/override/save', { staff: staffId, date, closed: true, intervals: [], note: '' }, t('adm.saved'))} />
        {ov && <Cell title={t('adm.back_normal')} onClick={() => void call('admin/override/delete', { staff: staffId, date }, t('adm.saved'))} />}
        {boot.can_manage && <Cell title={t('adm.studio_closed')} onClick={() => void call('admin/override/save', { staff: 0, date, closed: true, intervals: [], note: '' }, t('adm.saved'))} />}
      </Section>
      <Section title={t('adm.special')}>
        <div class="row2">
          <input class="inline-input" type="time" step={300} aria-label={t('adm.from')} value={hours.from} onInput={(e) => setHours({ ...hours, from: (e.target as HTMLInputElement).value })} />
          <input class="inline-input" type="time" step={300} aria-label={t('adm.to')} value={hours.to} onInput={(e) => setHours({ ...hours, to: (e.target as HTMLInputElement).value })} />
        </div>
        <Button secondary onClick={() => void call('admin/override/save', { staff: staffId, date, closed: false, intervals: [[hours.from, hours.to]], note: '' }, t('adm.saved'))}>{t('adm.set_hours')}</Button>
      </Section>
      <Section title={t('adm.block')}>
        <div class="row2">
          <input class="inline-input" type="time" step={300} aria-label={t('adm.from')} value={blk.from} onInput={(e) => setBlk({ ...blk, from: (e.target as HTMLInputElement).value })} />
          <input class="inline-input" type="time" step={300} aria-label={t('adm.to')} value={blk.to} onInput={(e) => setBlk({ ...blk, to: (e.target as HTMLInputElement).value })} />
        </div>
        <label class="field"><span>{t('adm.reason')}</span><input maxLength={120} value={blk.reason} onInput={(e) => setBlk({ ...blk, reason: (e.target as HTMLInputElement).value })} /></label>
        <Button secondary onClick={() => void call('admin/block/add', { staff: staffId, start: toUtc(date, parseHm(blk.from), tz), end: toUtc(date, parseHm(blk.to), tz), reason: blk.reason }, t('adm.saved'))}>{t('adm.add_block')}</Button>
        {blocks.map((b) => <Cell title={`${hhmm(minutesOf(b.start, tz))}–${hhmm(minutesOf(b.end, tz))}`} subtitle={b.reason || undefined} after={t('adm.remove')} onClick={() => void call('admin/block/delete', { id: b.id }, t('adm.saved'))} />)}
      </Section>
    </Sheet>
  );
}
