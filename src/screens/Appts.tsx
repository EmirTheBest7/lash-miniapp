import { useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { duration, whenLong } from '../format';
import { useBack } from '../hooks';
import { t } from '../i18n';
import type { Ctx } from '../nav';
import { confirmNative, haptic, openTelegramLink } from '../tg';
import type { Appt } from '../types';
import { Cell, Empty, Section, Sheet } from '../ui/components';

export function Appts({ ctx }: { ctx: Ctx }) {
  const { boot } = ctx;
  const [open, setOpen] = useState<Appt | null>(null);
  useBack(() => ctx.pop());

  async function cancel(a: Appt) {
    const ok = await confirmNative(t('appts.cancel_confirm', { service: a.service, when: whenLong(a.date, a.time) }));
    if (!ok) return;
    setOpen(null);
    const r = await api<{ outcome: string; my: Appt[] }>('appointments/cancel', { id: a.id, revision: a.rev }, newOpId());
    if (!r.ok) {
      if (r.error.code === 'stale_revision') { ctx.toast(t('err.stale')); await ctx.reload(); return; }
      ctx.toast(t('err.network')); return;
    }
    ctx.setMy(r.data.my);
    haptic.success();
    ctx.toast(r.data.outcome === 'ok' ? t('appts.cancelled') : t('appts.too_late'));
  }

  function message() {
    const u = boot.config.contact_username;
    if (u) openTelegramLink(`https://t.me/${u}`); else ctx.toast(t('appts.no_contact'));
  }

  return (
    <div class="page">
      <h1 class="large">{t('appts.title')}</h1>
      {boot.my.length === 0 && <Empty title={t('appts.empty')} icon="calendar" />}
      {boot.my.length > 0 && (
        <Section>
          {boot.my.map((a) => (
            <Cell title={whenLong(a.date, a.time)} subtitle={`${a.service} · ${duration(a.duration_min)}${a.staff ? ` · ${a.staff}` : ''}`} after={t(a.status === 'confirmed' ? 'appts.confirmed' : 'appts.pending')} chevron onClick={() => setOpen(a)} />
          ))}
        </Section>
      )}
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.service}>
        {open && (
          <Section footer={open.status === 'pending' && open.decide_by ? t('done.decide_by', { by: open.decide_by }) : undefined}>
            <Cell title={whenLong(open.date, open.time)} subtitle={duration(open.duration_min) + (open.staff ? ` · ${open.staff}` : '')} />
            {open.can_change ? (
              <>
                <Cell icon="calendar" title={t('appts.reschedule')} chevron onClick={() => { const a = open; setOpen(null); ctx.push({ k: 'pick', service: a.service_id, addons: [], move: a }); }} />
                <Cell title={t('appts.cancel')} destructive onClick={() => void cancel(open)} />
              </>
            ) : (
              <>
                <Cell title={t('appts.too_late')} />
                <Cell icon="user" title={t('appts.message')} chevron onClick={message} />
              </>
            )}
          </Section>
        )}
      </Sheet>
    </div>
  );
}
