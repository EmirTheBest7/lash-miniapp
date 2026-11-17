import { useBack } from '../hooks';
import { whenLong } from '../format';
import { t } from '../i18n';
import type { Ctx } from '../nav';
import { Icon } from '../ui/Icon';
import { Cell, MainAction, Section } from '../ui/components';

export function Done({ ctx, kind, when, service, staff, decideBy }: { ctx: Ctx; kind: 'confirmed' | 'pending' | 'moved'; when: { date: string; time: string }; service: string; staff: string | null; decideBy: string | null }) {
  useBack(() => ctx.home());
  const title = kind === 'confirmed' ? t('done.confirmed') : kind === 'moved' ? t('done.moved') : t('done.pending');
  return (
    <div class="page">
      <div class="big-check"><Icon name="check" /></div>
      <h1 class="large center" data-testid="done-title">{title}</h1>
      <Section>
        <Cell title={service} subtitle={whenLong(when.date, when.time) + (staff ? ` · ${staff}` : '')} />
      </Section>
      <div class="muted center">
        {kind === 'pending' && decideBy ? t('done.decide_by', { by: decideBy }) : null}
        {kind !== 'pending' ? t('done.calendar') : null}
      </div>
      <Section>
        <Cell icon="list" title={t('btn.my')} chevron onClick={() => ctx.replace({ k: 'appts' })} />
      </Section>
      <MainAction text={t('btn.done')} onClick={() => ctx.home()} />
    </div>
  );
}
