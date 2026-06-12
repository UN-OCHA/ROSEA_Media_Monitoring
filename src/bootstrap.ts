import { initApp } from './app';

export function bootstrap(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initApp(); });
  } else {
    initApp();
  }
}
