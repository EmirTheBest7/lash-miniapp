import { describe, expect, it } from 'vitest';
import { needsReload } from '../src/version';

describe('stale bundle guard', () => {
  it('reloads once when the deployed build differs from the running one', () => {
    expect(needsReload('aaa', 'bbb', null)).toBe(true);
    expect(needsReload('aaa', 'bbb', 'bbb')).toBe(false);   // already reloaded for bbb: never loop
    expect(needsReload('bbb', 'bbb', null)).toBe(false);
    expect(needsReload('dev', 'bbb', null)).toBe(false);    // local dev
    expect(needsReload('aaa', null, null)).toBe(false);     // offline / no version.json
  });
});
