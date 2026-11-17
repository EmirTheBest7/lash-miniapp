import { useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { dayLong, duration, money } from '../format';
import { LANGS, setLang, t } from '../i18n';
import type { Ctx } from '../nav';
import type { LangCode, Service } from '../types';
import { Cell, Empty, Section, Segmented, Sheet, Switch } from '../ui/components';

const LANG_NAME: Record<LangCode, string> = { cs: 'Čeština', en: 'English', ru: 'Русский', uk: 'Українська' };

export function Home({ ctx }: { ctx: Ctx }) {
  const { boot } = ctx;
  const [langOpen, setLangOpen] = useState(false);
  const all = boot.categories.flatMap((c) => c.services);
  const again = boot.again ? all.find((s) => s.id === boot.again!.service_id) : undefined;
  const sub = (s: Service) => `${duration(s.duration_min)} · ${money(s.price, s.price_from)}`;

  const [mk, setMk] = useState(boot.marketing);
  async function toggleMarketing(on: boolean) {
    setMk(on);
    const r = await api('marketing', { on }, newOpId());
    if (!r.ok) setMk(!on);
  }

  async function changeLang(l: LangCode) {
    setLangOpen(false);
    const r = await api('language', { lang: l }, newOpId());
    if (r.ok) { setLang(l); await ctx.reload(); }
  }

  return (
    <div class="page">
      <h1 class="large">{boot.config.studio_name || t('home.title')}</h1>
      {boot.loyalty && (
        <Section>
          <Cell icon="calendar" title={t('loy.title')} subtitle={boot.loyalty.ready !== null ? t('loy.ready', { p: boot.loyalty.ready }) : boot.loyalty.pending ? t('loy.pending') : t('loy.progress', { n: boot.loyalty.progress, total: boot.loyalty.visits, p: boot.loyalty.percent })} after={`${boot.loyalty.progress}/${boot.loyalty.visits}`} />
        </Section>
      )}
      {again && boot.again && (
        <Section>
          <Cell icon="calendar" title={t('home.book_again', { service: again.name })} subtitle={t('home.suggested', { date: dayLong(boot.again.suggest) })} chevron
            onClick={() => ctx.push({ k: 'pick', service: again.id, addons: [], prefer: boot.again!.suggest })} />
        </Section>
      )}
      {boot.categories.length === 0 && <Empty title={t('home.empty')} icon="calendar" />}
      {boot.categories.map((c) => (
        <Section title={c.name || t('home.title')}>
          {c.services.map((s) => <Cell title={s.name} subtitle={sub(s)} chevron onClick={() => ctx.push({ k: 'pick', service: s.id, addons: [] })} />)}
        </Section>
      ))}
      {boot.me.role !== 'client' && <Section><Cell icon="settings" title={t('home.staff_app')} chevron onClick={() => ctx.exitClientView?.()} /></Section>}
      <Section>
        <Cell icon="list" title={t('home.my')} after={boot.my.length ? String(boot.my.length) : undefined} chevron onClick={() => ctx.push({ k: 'appts' })} />
        <Cell icon="settings" title={t('home.offers')} subtitle={t('home.offers_note')} after={<Switch label={t('home.offers')} checked={mk} onChange={(on) => void toggleMarketing(on)} />} />
        <Cell icon="settings" title={t('home.language')} after={LANG_NAME[boot.me.lang]} chevron onClick={() => setLangOpen(true)} />
      </Section>
      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t('home.language')}>
        <Segmented options={LANGS.map((l) => ({ value: l, label: l.toUpperCase() }))} value={boot.me.lang} onChange={(l) => void changeLang(l)} />
      </Sheet>
    </div>
  );
}
