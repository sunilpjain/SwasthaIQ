export type EnvName = 'dev' | 'demo';

export interface EnvConfig {
  envName: EnvName;
  apiDomain: string;
  webDomain: string;
  /** ACM certificate in us-east-1 for CloudFront; empty until DNS (DIG-20) is validated. */
  webCertificateArn: string;
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
