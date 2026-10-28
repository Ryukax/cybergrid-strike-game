import {
  Component,
  useEffect,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';

import './game/install-browser-polyfills';

import './index.css';

declare global {
  interface Window {
    __CYBERGRID_BOOT__?: {
      ready(): void;
      fail(kind: string, reason: unknown): void;
    };
  }
}

class StartupErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const component = info.componentStack?.trim().split('\n')[0] ?? '';
    window.__CYBERGRID_BOOT__?.fail(
      'Safari render error',
      `${error.message}${component ? ` · ${component}` : ''}`,
    );
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div id="boot-status" role="alert">
        <div>
          <strong>CYBERGRID STARTUP RECOVERY</strong>
          <small>{this.state.error.message || 'Safari could not render the game.'}</small>
          <button type="button" onClick={() => window.location.reload()}>Reload game</button>
        </div>
      </div>
    );
  }
}

function StartupReady({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.__CYBERGRID_BOOT__?.ready();
  }, []);
  return children;
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  window.__CYBERGRID_BOOT__?.fail('Safari startup error', 'The game root element is missing.');
} else {
  void import('./App')
    .then(({ default: App }) => {
      createRoot(rootElement).render(
        <StartupErrorBoundary>
          <StartupReady>
            <App />
          </StartupReady>
        </StartupErrorBoundary>,
      );
    })
    .catch((error: unknown) => {
      window.__CYBERGRID_BOOT__?.fail('Safari module error', error);
    });
}
