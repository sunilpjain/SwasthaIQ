export type EnvName = 'dev' | 'demo';

export interface EnvConfig {
  envName: EnvName;
  apiDomain: string;
  webDomain: string;
}

/** Route 53 hosted zone for swasthyaiq.in (DIG-20). Empty id = no DNS records or custom domains. */
export interface DnsConfig {
  zoneName: string;
  hostedZoneId: string;
}

export const PROJECT_TAG = { key: 'project', value: 'arihant-prototype' } as const;
export const REGION = 'ap-south-1';

/** The three fixed logins (DIG-32). Passwords are set out-of-band; see infra/README.md. */
export const FIXED_USERS = [
  { username: 'saiyam', group: 'doctor' },
  { username: 'samradnyee', group: 'doctor' },
  { username: 'admin', group: 'admin' },
] as const;

export function prefix(env: EnvName): string {
  return `swasthyaiq-${env}`;
}
