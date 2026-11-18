/**
 * Dev-only load profile: the split of "why does the app open slowly" into the page + assets, Telegram's script, the API call(s) and rendering.
 * Active only in dev / mock builds, with ?perf in the URL, or in a build made with VITE_PERF=1. It prints ONE console table and stores nothing; production behaves as if this file did not exist.
 */
const on = (): boolean => import.meta.env.DEV || import.meta.env.VITE_MOCK === '1' || import.meta.env.VITE_PERF === '1' || new URLSearchParams(location.search).has('perf');
const marks: [string, number][] = [];

export const perfMark = (name: string): void => { if (on()) marks.push([name, Math.round(performance.now())]); };

/** Called once the first real content is on screen. */
export function perfReport(): void {
  if (!on()) return;
  perfMark('first-content');
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const res = performance.getEntriesByType('resource').map((r) => ({ name: r.name.replace(/^https?:\/\/[^/]+/, '').slice(0, 60), start: Math.round(r.startTime), ms: Math.round(r.duration), kB: Math.round(((r as PerformanceResourceTiming).transferSize ?? 0) / 1024) }));
  // eslint-disable-next-line no-console
  console.info('[perf] marks (ms since navigation start): ' + marks.map(([n, v]) => `${n}=${v}`).join(' | '), '\n[perf] document', nav ? { ttfb: Math.round(nav.responseStart), domReady: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) } : null, '\n[perf] resources', res);
}
