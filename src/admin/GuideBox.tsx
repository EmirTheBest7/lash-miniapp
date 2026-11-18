import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { getLang, t } from '../i18n';
import { Cell, Section, Sheet } from '../ui/components';
import guide from './guide.json';       // GENERATED from the bot repo's docs/master-guide-<lang>.md by scripts/sync-guide.sh: do not edit

type Block = { t: 'p' | 'ul' | 'ol'; x: string | string[] };
type Guide = { title: string; sections: { title: string; blocks: Block[] }[] };
const GUIDES = guide as unknown as Record<string, Guide>;

/** **bold** and `code`, nothing else (the guide's whole inline dialect). */
function inline(s: string): ComponentChildren {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part);
}

/** The master guide where she works: Settings -> "Master guide". Same text as /navod in the chat; Czech until the other languages exist. */
export function GuideBox() {
  const [open, setOpen] = useState(false);
  const g = GUIDES[getLang()] ?? GUIDES.cs;
  if (!g) return null;
  return (
    <>
      <Section footer={t('adm.guide_note')}>
        <Cell title={t('adm.guide')} chevron onClick={() => setOpen(true)} />
      </Section>
      <Sheet open={open} onClose={() => setOpen(false)} title={g.title}>
        <div class="guide">
          {g.sections.map((s, si) => (
            <section key={si}>
              {s.title && <h3>{s.title}</h3>}
              {s.blocks.map((b, bi) => b.t === 'p'
                ? <p key={bi}>{inline(b.x as string)}</p>
                : b.t === 'ul'
                  ? <ul key={bi}>{(b.x as string[]).map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>
                  : <ol key={bi}>{(b.x as string[]).map((li, i) => <li key={i}>{inline(li)}</li>)}</ol>)}
            </section>
          ))}
        </div>
      </Sheet>
    </>
  );
}
