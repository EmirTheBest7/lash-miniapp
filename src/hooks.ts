import { useEffect, useRef, useState } from 'preact/hooks';
import { bindBack } from './tg';

/** Native BackButton while this screen is mounted. */
export function useBack(handler: (() => void) | null): void {
  const ref = useRef(handler);
  ref.current = handler;
  const on = handler !== null;
  useEffect(() => (on ? bindBack(() => ref.current?.()) : undefined), [on]);
}

export function useToast(): [string | null, (text: string) => void] {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (t: string) => { setText(t); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setText(null), 3200); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [text, show];
}
