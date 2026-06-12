import { beforeEach, describe, expect, it } from 'vitest';
import { getAppContext, initApp, resetApp } from '../../src/app';

describe('AppContext', () => {
  beforeEach(() => {
    resetApp();
  });

  it('throws before initialization', () => {
    expect(() => getAppContext()).toThrow('App not initialized');
  });

  it('returns a context with a numeric startedAt after initApp', () => {
    const before = Date.now();
    initApp();
    const after = Date.now();
    const ctx = getAppContext();
    expect(ctx.startedAt).toBeGreaterThanOrEqual(before);
    expect(ctx.startedAt).toBeLessThanOrEqual(after);
  });

  it('returns the same object on repeated getAppContext calls', () => {
    initApp();
    expect(getAppContext()).toBe(getAppContext());
  });

  it('resets cleanly so tests are isolated', () => {
    initApp();
    resetApp();
    expect(() => getAppContext()).toThrow('App not initialized');
  });
});
