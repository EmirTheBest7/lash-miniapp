import { useEffect, useState } from 'preact/hooks';
import { getLang, t } from '../i18n';
import { Button, Cell, Section } from '../ui/components';
import { Shell } from './Shell';
import type { Ctx } from './useSettings';

interface Topic { id: string; title: string; steps: string[]; open: string }
type Help = Record<string, { title: string; topics: Topic[] }>;

/** **bold** and `code`, nothing else (the whole inline dialect of the help sources). */
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => (part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part));
}

/** Where a topic's button goes: exactly that screen. */
export function runTarget(c: Ctx, target: string): void {
  switch (target) {
    case 'wizard': c.openWizard(0); break;
    case 'services': c.goTab('svc'); break;
    case 'calendar': c.goTab('cal'); break;
    case 'vouchers': c.goTab('vch'); break;
    case 'studio': c.open('studio'); break;
    case 'rules': c.open('rules'); break;
    case 'preview': c.open('after'); break;
    case 'client': c.onClientView(); break;
    default: break;
  }
}

/** Help: a list of short task topics (the language of the app), each with 2-4 steps and a button that opens that screen. The sources live in the bot repo (docs/master-guide-<lang>.md). */
export function HelpScreen({ c, initialTopic }: { c: Ctx; initialTopic?: string }) {
  const [help, setHelp] = useState<Help | null>(null);
  const [open, setOpen] = useState<string | null>(initialTopic ?? null);
  useEffect(() => { void import('./help.json').then((m) => setHelp((m.default ?? m) as unknown as Help)); }, []);
  const g = help ? (help[getLang()] ?? help.cs) : null;
  const topic = g?.topics.find((x) => x.id === open) ?? null;
  const can = (tp: Topic): boolean => tp.open !== 'none' && (c.boot.can_manage || ['calendar', 'client', 'services'].includes(tp.open)) && !(tp.open === 'vouchers' && !c.boot.vouchers_on);
  if (topic) {
    return (
      <Shell title={topic.title} onBack={() => setOpen(null)}>
        <Section>
          <ol class="help-steps" data-testid="help-steps">{topic.steps.map((s, i) => <li key={i}>{inline(s)}</li>)}</ol>
        </Section>
        {can(topic) && <div class="section"><Button onClick={() => runTarget(c, topic.open)}>{t('adm.h_open_' + topic.open)}</Button></div>}
      </Shell>
    );
  }
  return (
    <Shell title={t('adm.s_help')} onBack={() => c.open(null)}>
      <Section>
        {(g?.topics ?? []).filter((x) => x.id !== 'wizard' || c.boot.can_manage).map((x) => <Cell key={x.id} title={x.title} chevron onClick={() => setOpen(x.id)} />)}
      </Section>
      <Section footer={t('adm.client_view_note')}>
        <Cell icon="user" title={t('adm.client_view')} chevron onClick={c.onClientView} />
      </Section>
    </Shell>
  );
}
