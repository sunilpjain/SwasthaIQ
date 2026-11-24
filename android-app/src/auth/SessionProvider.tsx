import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import type { UserSummary } from '@swasthyaiq/shared';
import { ApiClient } from '../api/client';
import { clearDrafts } from '../consult/draft-registry';
import { env } from '../config/env';
import { CognitoClient } from './cognito';
import { deviceBiometrics, secureStore } from './device';
import { SessionManager, type SessionState } from './session';

/** One session and one API client for the whole app. */
export const session = new SessionManager({
  cognito: new CognitoClient(env.cognito),
  store: secureStore,
  biometrics: deviceBiometrics,
  // Log out and remote sign-out wipe what this phone holds about patients.
  wipe: async () => clearDrafts(),
});

export const api = new ApiClient(
  env.apiBaseUrl,
  () => session.getAccessToken(),
  fetch,
  15_000,
  (code) => session.handleUnauthorized(code),
);

interface SessionContextValue {
  state: SessionState;
  /** The signed-in doctor, loaded after sign-in or unlock. */
  me: UserSummary | null;
}

const SessionContext = createContext<SessionContextValue>({ state: { status: 'loading' }, me: null });

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

const IDLE_CHECK_MS = 30_000;

/**
 * Starts the session, tracks touches for the 15-minute idle lock, and re-checks idleness when the
 * app returns to the foreground.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(session.state);
  const [me, setMe] = useState<UserSummary | null>(null);

  useEffect(() => {
    const unsubscribe = session.subscribe(setState);
    void session.start();
    const timer = setInterval(() => session.checkIdle(), IDLE_CHECK_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') session.checkIdle();
    });
    return () => {
      unsubscribe();
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (state.status !== 'active') {
      if (state.status === 'signedOut') setMe(null);
      return;
    }
    let cancelled = false;
    api
      .me()
      .then((u) => {
        if (!cancelled) setMe(u);
      })
      .catch(() => undefined); // offline: the profile fills in on the next unlock
    return () => {
      cancelled = true;
    };
  }, [state.status]);

  const value = useMemo(() => ({ state, me }), [state, me]);
  return (
    <SessionContext.Provider value={value}>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          session.touch();
          return false;
        }}
      >
        {children}
      </View>
    </SessionContext.Provider>
  );
}
