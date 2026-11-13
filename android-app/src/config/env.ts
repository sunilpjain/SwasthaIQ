export type AppEnv = 'dev' | 'demo';

export interface EnvSettings {
  appEnv: AppEnv;
  apiBaseUrl: string;
  wsUrl: string;
}

const ENVIRONMENTS: Record<AppEnv, Omit<EnvSettings, 'appEnv'>> = {
  dev: {
    apiBaseUrl: 'https://dev-api.swasthyaiq.cognihealth.in',
    wsUrl: 'wss://dev-api.swasthyaiq.cognihealth.in/ws',
  },
  demo: {
    apiBaseUrl: 'https://api.swasthyaiq.cognihealth.in',
    wsUrl: 'wss://api.swasthyaiq.cognihealth.in/ws',
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
  return { appEnv, apiBaseUrl: override, wsUrl: `${override.replace(/^http/, 'ws')}/ws` };
}

export const env = resolveEnv({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
