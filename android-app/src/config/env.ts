export type AppEnv = 'dev' | 'demo';

export interface CognitoSettings {
  region: string;
  /** Public app client (no secret). Empty until that environment's Auth stack is deployed. */
  clientId: string;
}

export interface EnvSettings {
  appEnv: AppEnv;
  apiBaseUrl: string;
  wsUrl: string;
  cognito: CognitoSettings;
}

const ENVIRONMENTS: Record<AppEnv, Omit<EnvSettings, 'appEnv'>> = {
  // Client ids are public (they ship in the app); from the AndroidClientId output of
  // SwasthyaIQ-<env>-Auth. Pool ap-south-1_sGjfFpZxx (dev).
  dev: {
    apiBaseUrl: 'https://dev-api.swasthyaiq.in',
    wsUrl: 'wss://dev-api.swasthyaiq.in/ws',
    cognito: { region: 'ap-south-1', clientId: '28oce8veem4lbh3fugj9feocp4' },
  },
  demo: {
    apiBaseUrl: 'https://api.swasthyaiq.in',
    wsUrl: 'wss://api.swasthyaiq.in/ws',
    // Set when SwasthyaIQ-demo-Auth is deployed; until then a demo build cannot sign in.
    cognito: { region: 'ap-south-1', clientId: '' },
  },
};

/**
 * Resolves the backend for this build. EXPO_PUBLIC_APP_ENV is inlined at build time (eas.json);
 * EXPO_PUBLIC_API_URL overrides it for a local API during development.
 */
export function resolveEnv(vars: Record<string, string | undefined> = process.env): EnvSettings {
  const appEnv: AppEnv = vars.EXPO_PUBLIC_APP_ENV === 'demo' ? 'demo' : 'dev';
  const base = ENVIRONMENTS[appEnv];
  const override = vars.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (!override) return { appEnv, ...base };
  return { ...base, appEnv, apiBaseUrl: override, wsUrl: `${override.replace(/^http/, 'ws')}/ws` };
}

export const env = resolveEnv({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
