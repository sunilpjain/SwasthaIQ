/**
 * DIG-32: prove the Android sign-in session against the real Cognito user pool.
 *
 *   pnpm --filter api exec tsx scripts/check-cognito-session.ts [--env dev|demo] [--user <username>]
 *
 * Checks, in order:
 *   1. Login with username + password works (USER_PASSWORD_AUTH on the android client).
 *   2. Silent renewal: GetTokensFromRefreshToken returns new tokens without the password,
 *      rotates the refresh token (new 7-day token), and keeps the same login session (auth_time).
 *      The replaced refresh token stops working once the rotation grace period has passed.
 *   3. Revoke (admin remote sign-out, AdminUserGlobalSignOut): the refresh token no longer
 *      renews and Cognito rejects the access token, so the app must ask for the password again.
 *   4. A fresh password login works after the revoke.
 *
 * Default: creates a throwaway user `dig32-check-<random>` with a random password held only in
 * memory, and deletes it at the end. With --user, checks one of the real users instead: you type
 * its password at a hidden prompt, and that user is signed out on every device by step 3.
 * Never prints passwords or tokens.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  type AuthenticationResultType,
  CognitoIdentityProviderClient,
  DescribeUserPoolClientCommand,
  GetTokensFromRefreshTokenCommand,
  GetUserCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = 'ap-south-1';
const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const envName = arg('--env') ?? 'dev';
const realUser = arg('--user');

const cognito = new CognitoIdentityProviderClient({ region: REGION });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(ok: boolean, what: string, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` (${detail})` : ''}`);
}

/** JWT payload claims; signature is not checked here (the API does that). */
function claims(jwt: string | undefined): Record<string, number | string> {
  const part = (jwt ?? '').split('.')[1] ?? '';
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, number | string>;
}

async function rejects(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as Error).name;
  }
}

async function stackOutputs(): Promise<{ poolId: string; clientId: string }> {
  const cf = new CloudFormationClient({ region: REGION });
  const stackName = `SwasthyaIQ-${envName}-Auth`;
  const res = await cf.send(new DescribeStacksCommand({ StackName: stackName }));
  const out = new Map((res.Stacks?.[0]?.Outputs ?? []).map((o) => [o.OutputKey, o.OutputValue]));
  const poolId = out.get('UserPoolId');
  const clientId = out.get('AndroidClientId');
  if (!poolId || !clientId) throw new Error(`UserPoolId/AndroidClientId missing from ${stackName}`);
  return { poolId, clientId };
}

/** Reads a password without echoing it. */
function promptHidden(question: string): Promise<string> {
  const muted = new Writable({ write: (_c, _e, cb) => cb() });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write(question);
  return new Promise((resolve) =>
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    }),
  );
}

async function login(
  clientId: string,
  username: string,
  password: string,
): Promise<AuthenticationResultType> {
  const res = await cognito.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }),
  );
  if (!res.AuthenticationResult)
    throw new Error(`login returned a challenge (${res.ChallengeName ?? 'unknown'})`);
  return res.AuthenticationResult;
}

const renew = (clientId: string, refreshToken: string | undefined) =>
  cognito.send(new GetTokensFromRefreshTokenCommand({ ClientId: clientId, RefreshToken: refreshToken }));

async function main(): Promise<void> {
  const { poolId, clientId } = await stackOutputs();
  console.log(`Cognito ${envName}: pool ${poolId}, android client ${clientId}\n`);

  const client = await cognito.send(
    new DescribeUserPoolClientCommand({ UserPoolId: poolId, ClientId: clientId }),
  );
  const cfg = client.UserPoolClient;
  const graceS = cfg?.RefreshTokenRotation?.RetryGracePeriodSeconds ?? 0;
  // CDK writes Duration.days(7) as 10080 minutes, so compare in hours.
  const unitHours: Record<string, number> = { seconds: 1 / 3600, minutes: 1 / 60, hours: 1, days: 24 };
  const refreshHours =
    (cfg?.RefreshTokenValidity ?? 0) * (unitHours[cfg?.TokenValidityUnits?.RefreshToken ?? 'days'] ?? 0);
  check(
    refreshHours === 7 * 24,
    'android client: refresh token valid for 7 days',
    `${cfg?.RefreshTokenValidity} ${cfg?.TokenValidityUnits?.RefreshToken}`,
  );
  check(
    cfg?.RefreshTokenRotation?.Feature === 'ENABLED',
    'android client: refresh token rotation on',
    `grace ${graceS} s`,
  );
  check(cfg?.EnableTokenRevocation === true, 'android client: token revocation on');

  let username = realUser ?? '';
  let password: string;
  if (realUser) {
    console.log(`\nChecking real user "${realUser}". Step 3 signs this user out on every device.`);
    password = await promptHidden(`Password for ${realUser}: `);
  } else {
    username = `dig32-check-${randomUUID().slice(0, 8)}`;
    // Meets the pool policy (12+ chars, upper, lower, digit). Held in memory only.
    password = `Aa1${randomBytes(24).toString('base64url')}`;
    await cognito.send(
      new AdminCreateUserCommand({ UserPoolId: poolId, Username: username, MessageAction: 'SUPPRESS' }),
    );
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: username,
        Password: password,
        Permanent: true,
      }),
    );
    console.log(`\nCreated throwaway user ${username} (deleted at the end).`);
  }

  try {
    // 1. Login
    console.log('\n1. Login');
    const first = await login(clientId, username, password);
    check(Boolean(first.AccessToken && first.RefreshToken), 'password login returns access + refresh tokens');
    check(
      (await rejects(cognito.send(new GetUserCommand({ AccessToken: first.AccessToken })))) === null,
      'access token accepted',
    );
    const c1 = claims(first.AccessToken);
    check(
      c1.token_use === 'access' && c1.client_id === clientId,
      'token is an access token for the android client',
    );

    // 2. Silent renewal (no password)
    console.log('\n2. Silent renewal');
    await sleep(2000); // so the new token's iat is visibly later
    const r1 = (await renew(clientId, first.RefreshToken)).AuthenticationResult;
    check(Boolean(r1?.AccessToken), 'renewal without password returns a new access token');
    check(
      Boolean(r1?.RefreshToken) && r1?.RefreshToken !== first.RefreshToken,
      'refresh token rotated (new 7-day token issued)',
    );
    const c2 = claims(r1?.AccessToken);
    check(
      Number(c2.iat) > Number(c1.iat),
      'new access token issued later',
      `iat +${Number(c2.iat) - Number(c1.iat)} s`,
    );
    check(
      Number(c2.exp) > Number(c1.exp),
      'session end moved forward',
      `exp +${Number(c2.exp) - Number(c1.exp)} s`,
    );
    check(c2.auth_time === c1.auth_time, 'same login session (auth_time unchanged)');
    const r2 = (await renew(clientId, r1?.RefreshToken)).AuthenticationResult;
    check(
      Boolean(r2?.AccessToken) && r2?.RefreshToken !== r1?.RefreshToken,
      'renewing again with the rotated token works',
    );
    console.log(`   waiting ${graceS + 3} s for the rotation grace period to pass ...`);
    await sleep((graceS + 3) * 1000);
    const oldErr = await rejects(renew(clientId, first.RefreshToken));
    check(oldErr !== null, 'replaced refresh token no longer renews', oldErr ?? 'still worked');

    // 3. Revoke (admin remote sign-out)
    console.log('\n3. Revoke');
    await cognito.send(new AdminUserGlobalSignOutCommand({ UserPoolId: poolId, Username: username }));
    const renewErr = await rejects(renew(clientId, r2?.RefreshToken));
    check(renewErr !== null, 'after sign-out the refresh token cannot renew', renewErr ?? 'still worked');
    const getUserErr = await rejects(cognito.send(new GetUserCommand({ AccessToken: r2?.AccessToken })));
    check(
      getUserErr !== null,
      'after sign-out Cognito rejects the access token',
      getUserErr ?? 'still accepted',
    );
    console.log(
      '   (The API rejects revoked tokens within 30 s via session_revocations; covered by api/test.)',
    );

    // 4. Re-login
    console.log('\n4. Re-login');
    const again = await login(clientId, username, password);
    check(Boolean(again.AccessToken && again.RefreshToken), 'password login works again after sign-out');
  } finally {
    if (!realUser) {
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: username }));
      console.log(`\nDeleted throwaway user ${username}.`);
    }
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e: unknown) => {
  console.error(`${(e as Error).name}: ${(e as Error).message}`);
  process.exit(1);
});
