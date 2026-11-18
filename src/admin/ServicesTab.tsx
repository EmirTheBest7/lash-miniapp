import { useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { duration, money } from '../format';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Section, Sheet, Switch } from '../ui/components';
import { LangTabs } from './LangTabs';
import { PreviewBox } from './PreviewBox';
import type { AdminBoot, SvcRow } from './types';

type Names = Record<'cs' | 'en' | 'ru' | 'uk', string>;
const EMPTY: Names = { cs: '', en: '', ru: '', uk: '' };
const NEW_CAT = -1;

/** Create, rename, price, time and delete services and add-ons. The buffer is reserved on the calendar but never shown to customers. */
export function ServicesTab({ boot, toast, reloadBoot }: { boot: AdminBoot; toast: (s: string) => void; reloadBoot: () => Promise<void> }) {
  // edit: an existing row, or { addon } while creating
  const [edit, setEdit] = useState<SvcRow | { addon: boolean } | null>(null);
  const [f, setF] = useState({ dur: 60, buf: 15, price: 0, from: false, active: true, staffOnly: false, names: EMPTY, after: EMPTY, desc: EMPTY, pre: EMPTY, rebook: 0, cat: 0, newCat: '' });
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const existing = edit !== null && 'id' in edit ? edit : null;
  const isAddon = edit !== null && ('id' in edit ? edit.is_addon : edit.addon);
  const open = (s: SvcRow) => { setEdit(s); setConfirmDel(false); setF({ dur: s.duration_min, buf: s.buffer_min, price: s.price, from: s.price_from, active: s.active, staffOnly: !!s.staff_only, names: s.names, desc: s.descriptions ?? EMPTY, pre: s.precare ?? EMPTY, after: s.aftercare ?? EMPTY, rebook: s.rebook_after_days ?? 0, cat: s.category_id ?? 0, newCat: '' }); };
  const create = (addon: boolean) => { setEdit({ addon }); setConfirmDel(false); setF({ dur: addon ? 15 : 60, buf: addon ? 0 : 15, price: 0, from: false, active: true, staffOnly: false, names: EMPTY, after: EMPTY, desc: EMPTY, pre: EMPTY, rebook: addon ? 0 : 14, cat: 0, newCat: '' }); };
  const num = (v: string): number => Math.max(0, Math.round(Number(v) || 0));

  async function save() {
    if (!edit || busy) return;
    if (!Object.values(f.names).some((n) => n.trim() !== '')) { haptic.error(); toast(t('adm.name_required')); return; }
    setBusy(true);
    const body: Record<string, unknown> = { duration_min: f.dur, buffer_min: f.buf, price: f.price, price_from: f.from, active: f.active, staff_only: f.staffOnly, names: f.names, descriptions: f.desc, precare: f.pre, aftercare: f.after, rebook_after_days: isAddon ? null : (f.rebook || null) };
    if (existing) body.id = existing.id; else body.is_addon = isAddon;
    if (!isAddon) { if (f.cat === NEW_CAT) { if (f.newCat.trim()) body.new_category = f.newCat.trim(); } else body.category_id = f.cat === 0 ? null : f.cat; }
    const r = await api('admin/service/save', body, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t(r.error.code === 'bad_request' ? 'adm.bad_input' : 'err.network')); return; }
    haptic.success(); toast(t('adm.saved')); setEdit(null); await reloadBoot();
  }

  async function remove() {
    if (!existing || busy) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    setBusy(true);
    const r = await api<{ deleted: boolean }>('admin/service/delete', { id: existing.id }, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t('err.network')); return; }
    haptic.success(); toast(t(r.data.deleted ? 'adm.deleted' : 'adm.hidden_only')); setEdit(null); await reloadBoot();
  }

  const group = (addon: boolean) => boot.services.filter((s) => s.is_addon === addon);
  const row = (s: SvcRow) => (
    <Cell title={s.name} subtitle={`${duration(s.duration_min)} + ${t('adm.buffer', { n: s.buffer_min })} · ${money(s.price, s.price_from)}`} after={s.active ? (s.staff_only ? t('adm.staff_only_tag') : undefined) : t('adm.inactive')} chevron onClick={() => open(s)} />
  );
  return (
    <div class="page">
      <h1 class="large">{t('adm.tab_services')}</h1>
      {boot.services.length === 0 && <div class="note" data-testid="svc-empty">{t('adm.svc_empty')}</div>}
      <Section footer={t('adm.svc_note')}>{group(false).map(row)}</Section>
      {group(true).length > 0 && <Section title={t('adm.addons')} footer={t('adm.addon_note')}>{group(true).map(row)}</Section>}
      <Section>
        <Cell title={t('adm.new_service')} chevron onClick={() => create(false)} />
        <Cell title={t('adm.new_addon')} chevron onClick={() => create(true)} />
      </Section>
      <Sheet open={edit !== null} onClose={() => setEdit(null)} title={existing ? existing.name : t(isAddon ? 'adm.new_addon' : 'adm.new_service')}>
        <Section footer={t('adm.names_note')}>
          <LangTabs label={t('adm.name_label')} values={f.names} rows={1} max={60} canTranslate={!!boot.can_translate} toast={toast} onChange={(l, v) => setF((p) => ({ ...p, names: { ...p.names, [l]: v } }))} />
          <LangTabs label={t('adm.desc_label')} values={f.desc} rows={2} max={300} canTranslate={!!boot.can_translate} toast={toast} onChange={(l, v) => setF((p) => ({ ...p, desc: { ...p.desc, [l]: v } }))} />
        </Section>
        {!isAddon && (
          <label class="field"><span>{t('adm.category')}</span>
            <select value={f.cat} onChange={(e) => setF({ ...f, cat: Number((e.target as HTMLSelectElement).value) })}>
              <option value={0}>{t('adm.cat_none')}</option>
              {boot.categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
              <option value={NEW_CAT}>{t('adm.cat_new')}</option>
            </select>
            {f.cat === NEW_CAT && <input maxLength={60} placeholder={t('adm.cat_new_ph')} value={f.newCat} onInput={(e) => setF({ ...f, newCat: (e.target as HTMLInputElement).value })} />}
          </label>
        )}
        <div class="row2">
          <label class="field" style={{ padding: 0 }}><span>{t('adm.duration')}</span><input type="number" inputMode="numeric" min={5} max={600} step={5} value={f.dur} onInput={(e) => setF({ ...f, dur: num((e.target as HTMLInputElement).value) })} /></label>
          <label class="field" style={{ padding: 0 }}><span>{t('adm.buffer_label')}</span><input type="number" inputMode="numeric" min={0} max={240} step={5} value={f.buf} onInput={(e) => setF({ ...f, buf: num((e.target as HTMLInputElement).value) })} /></label>
        </div>
        <div class="note" data-testid="reserved">{t('adm.reserved', { n: duration(f.dur + f.buf) })} · {t('adm.client_sees', { n: duration(f.dur) })}</div>
        <label class="field"><span>{t('adm.price')}</span><input type="number" inputMode="numeric" min={0} step={10} value={f.price} onInput={(e) => setF({ ...f, price: num((e.target as HTMLInputElement).value) })} /></label>
        <Section>
          <Cell title={t('adm.price_from')} after={<Switch label={t('adm.price_from')} checked={f.from} onChange={(v) => setF({ ...f, from: v })} />} />
          <Cell title={t('adm.active')} after={<Switch label={t('adm.active')} checked={f.active} onChange={(v) => setF({ ...f, active: v })} />} />
          <Cell title={t('adm.staff_only')} subtitle={t('adm.staff_only_hint')} after={<Switch label={t('adm.staff_only')} checked={f.staffOnly} onChange={(v) => setF({ ...f, staffOnly: v })} />} />
        </Section>
        {!isAddon && (
          <Section title={t('adm.aftercare')} footer={t('adm.aftercare_note')}>
            <label class="field"><span>{t('adm.rebook_days')}</span><input type="number" inputMode="numeric" min={0} max={365} value={f.rebook} onInput={(e) => setF({ ...f, rebook: Math.min(365, num((e.target as HTMLInputElement).value)) })} /></label>
            <LangTabs label={t('adm.aftercare_text')} values={f.after} rows={3} max={800} canTranslate={!!boot.can_translate} toast={toast} onChange={(l, v) => setF((p) => ({ ...p, after: { ...p.after, [l]: v } }))} />
            <LangTabs label={t('adm.precare_label')} values={f.pre} rows={3} max={800} canTranslate={!!boot.can_translate} toast={toast} onChange={(l, v) => setF((p) => ({ ...p, pre: { ...p.pre, [l]: v } }))} />
          </Section>
        )}
        {existing && !isAddon && <PreviewBox boot={boot} toast={toast} serviceId={existing.id} />}
        <Button onClick={() => void save()} disabled={busy}>{busy ? '…' : t('adm.save')}</Button>
        {existing && <Button secondary onClick={() => void remove()} disabled={busy}>{confirmDel ? t('adm.delete_confirm') : t('adm.delete')}</Button>}
      </Sheet>
    </div>
  );
}
