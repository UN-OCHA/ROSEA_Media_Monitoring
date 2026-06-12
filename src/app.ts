export interface AppContext {
  readonly startedAt: number;
}

let _ctx: AppContext | null = null;

export function initApp(): void {
  _ctx = { startedAt: Date.now() };
}

export function getAppContext(): AppContext {
  if (_ctx === null) {
    throw new Error('App not initialized. Call initApp() first.');
  }
  return _ctx;
}

export function resetApp(): void {
  _ctx = null;
}
