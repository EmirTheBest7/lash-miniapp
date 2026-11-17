/** The page itself can be served from Telegram's/Pages' cache. version.json is fetched uncached; a mismatch forces one reload. */
export function needsReload(running: string, latest: string | null, alreadyTriedFor: string | null): boolean {
  return !!latest && latest !== running && running !== 'dev' && alreadyTriedFor !== latest;
}

export async function ensureFresh(running: string, base: string): Promise<void> {
  try {
    const res = await fetch(`${base}version.json?ts=${Date.now()}`, { cache: 'no-store' });
    const latest = ((await res.json()) as { build?: string }).build ?? null;
    const url = new URL(location.href);
    if (needsReload(running, latest, url.searchParams.get('v'))) {
      url.searchParams.set('v', latest!);
      location.replace(url.toString());
    }
  } catch { /* offline or no version.json (dev): carry on */ }
}
