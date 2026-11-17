import { useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { duration, money } from '../format';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Chip, Section, Sheet, Switch } from '../ui/components';
import { hhmm, parseHm, toUtc } from './time';
import type { AdminBoot, ClientHit, MoveData } from './types';

/** Manual booking: client (search or a new one without Telegram), service, add-ons, person (or any), time. Same engine: never overlaps. */
export function NewAppt({ open, boot, tz, date, min, staffId, onClose, toast, reload }: {
  open: boolean; boot: AdminBoot; tz: string; date: string; min: number; staffId: number; onClose: () => void; toast: (s: string) => void; reload: () => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [client, setClient] = useState<ClientHit | null>(null);
  const [nc, setNc] = useState<{ name: string; phone: string } | null>(null);
  const [svc, setSvc] = useState<number | null>(null);
  const [addons, setAddons] = useState<number[]>([]);
  const [staff, setStaff] = useState(staffId);
  const [time, setTime] = useState(hhmm(min));
  const [outside, setOutside] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setClient(null); setNc(null); setQ(''); setHits([]); setSvc(null); setAddons([]); setOutside(false); } }, [open]);
  useEffect(() => { setStaff(staffId); setTime(hhmm(min)); }, [staffId, min]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const h = setTimeout(async () => { const r = await api<{ clients: ClientHit[] }>('admin/clients/search', { q }); if (r.ok) setHits(r.data.clients); }, 250);
    return () => clearTimeout(h);
  }, [q]);

  const mains = boot.services.filter((s) => s.active && !s.is_addon);
  const addonList = boot.services.filter((s) => s.active && s.is_addon);
  const people = boot.staff.filter((s) => s.active && (svc === null || !s.off.includes(svc)) && addons.every((a) => !s.off.includes(a)));
  useEffect(() => { if (staff > 0 && !people.some((p) => p.id === staff)) setStaff(0); }, [svc, addons.join(',')]);
  const main = mains.find((s) => s.id === svc);
  const total = main ? main.duration_min + addonList.filter((a) => addons.includes(a.id)).reduce((s, a) => s + a.duration_min, 0) : 0;

  async function submit() {
    if (busy || !svc || (!client && !nc?.name.trim())) return;
    setBusy(true);
    let cid = client?.id;
    if (!cid && nc) {
      const c = await api<{ client: ClientHit }>('admin/clients/create', { name: nc.name.trim(), phone: nc.phone.trim() }, newOpId());
      if (!c.ok) { setBusy(false); toast(t(c.error.code === 'bad_request' ? 'adm.bad_client' : 'err.network')); return; }
      cid = c.data.client.id;
    }
    const r = await api<MoveData>('admin/appointments/create', { client_id: cid, service: svc, addons, start: toUtc(date, parseHm(time), tz), staff, ...(outside ? { override: true } : {}) }, newOpId());
    setBusy(false);
    if (!r.ok) { toast(t('err.network')); return; }
    if (r.data.outcome === 'ok') { haptic.success(); toast(t('adm.created')); onClose(); await reload(); return; }
    haptic.warn();
    const alt = r.data.alternatives?.map((a) => a.time).join(', ');
    toast(alt ? t('adm.taken_alts', { times: alt }) : t('adm.not_free'));
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('adm.new')}>
      <Section title={t('adm.client')}>
        {client ? <Cell icon="user" title={client.name} subtitle={client.phone ?? undefined} after={t('adm.change')} onClick={() => setClient(null)} />
          : nc ? (
            <>
              <label class="field"><span>{t('adm.name')}</span><input value={nc.name} maxLength={60} onInput={(e) => setNc({ ...nc, name: (e.target as HTMLInputElement).value })} /></label>
              <label class="field"><span>{t('adm.phone')}</span><input inputMode="tel" value={nc.phone} maxLength={24} onInput={(e) => setNc({ ...nc, phone: (e.target as HTMLInputElement).value })} /></label>
            </>
          ) : (
            <>
              <label class="field"><span>{t('adm.search')}</span><input type="search" value={q} placeholder={t('adm.search_ph')} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
              {hits.map((h) => <Cell title={h.name} subtitle={[h.phone, h.username && '@' + h.username].filter(Boolean).join(' · ') || undefined} chevron onClick={() => setClient(h)} />)}
              <Cell icon="plus" title={t('adm.new_client')} chevron onClick={() => setNc({ name: q.trim(), phone: '' })} />
            </>
          )}
      </Section>
      <Section title={t('adm.service')}>
        {mains.map((s) => <Cell title={s.name} subtitle={`${duration(s.duration_min)} · ${money(s.price, s.price_from)}`} selected={svc === s.id} onClick={() => setSvc(s.id)} />)}
        {addonList.map((a) => <Cell title={a.name} subtitle={`+${duration(a.duration_min)}`} after={<Switch label={a.name} checked={addons.includes(a.id)} onChange={(on) => setAddons((c) => (on ? [...c, a.id] : c.filter((x) => x !== a.id)))} />} />)}
      </Section>
      {boot.staff.filter((s) => s.active).length > 1 && (
        <Section title={t('adm.staff')}>
          <div class="chips">
            {boot.can_manage && <Chip label={t('short.any')} selected={staff === 0} onClick={() => setStaff(0)} />}
            {people.map((p) => <Chip label={p.name || t('staff.default')} selected={staff === p.id} onClick={() => setStaff(p.id)} />)}
          </div>
        </Section>
      )}
      <Section title={t('adm.time')} footer={total ? t('adm.reserved', { n: duration(total) }) : undefined}>
        <label class="field"><span>{t('adm.start')}</span><input type="time" step={300} value={time} onInput={(e) => setTime((e.target as HTMLInputElement).value)} /></label>
        <Cell title={t('adm.outside')} after={<Switch label={t('adm.outside')} checked={outside} onChange={setOutside} />} />
      </Section>
      <Button onClick={() => void submit()} disabled={busy || !svc || (!client && !nc?.name.trim())}>{busy ? '…' : t('adm.create')}</Button>
    </Sheet>
  );
}
