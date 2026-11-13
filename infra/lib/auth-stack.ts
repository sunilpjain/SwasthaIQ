import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';
import { FIXED_USERS, prefix, type EnvConfig } from './config';

export interface AuthStackProps extends StackProps {
  config: EnvConfig;
}

/**
 * DIG-32 — Cognito user pool with the 3 fixed users and a 7-day sliding session.
 *
 * Sliding session: refresh tokens are valid 7 days and *rotate* — every silent renewal
 * returns a new refresh token with a fresh 7 days. A doctor who opens the app at least
 * once a week never types the password again. Admin remote sign-out revokes them.
 *
 * Passwords are NOT set here; see infra/README.md ("Set the three passwords").
 */
export class AuthStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly androidClient: cognito.UserPoolClient;
  readonly adminWebClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    const p = prefix(props.config.envName);

    this.userPool = new cognito.UserPool(this, 'Users', {
      userPoolName: `${p}-users`,
      selfSignUpEnabled: false,
      signInCaseSensitive: false,
      signInAliases: { username: true },
      accountRecovery: cognito.AccountRecovery.NONE,
      mfa: cognito.Mfa.OFF,
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(7),
      },
      deletionProtection: props.config.envName === 'demo',
      removalPolicy: props.config.envName === 'demo' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    const groups = {
      doctor: new cognito.CfnUserPoolGroup(this, 'DoctorGroup', {
        userPoolId: this.userPool.userPoolId,
        groupName: 'doctor',
        description: 'Android app users',
      }),
      admin: new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
        userPoolId: this.userPool.userPoolId,
        groupName: 'admin',
        description: 'Admin dashboard users',
      }),
    };

    for (const u of FIXED_USERS) {
      const user = new cognito.CfnUserPoolUser(this, `User-${u.username}`, {
        userPoolId: this.userPool.userPoolId,
        username: u.username,
        messageAction: 'SUPPRESS', // no invite email; passwords are set out-of-band
      });
      const attach = new cognito.CfnUserPoolUserToGroupAttachment(this, `UserGroup-${u.username}`, {
        userPoolId: this.userPool.userPoolId,
        username: u.username,
        groupName: u.group,
      });
      attach.addResourceDependency(user);
      attach.addResourceDependency(groups[u.group]);
    }

    const sessionClient = (name: string, refreshDays: number): cognito.UserPoolClient => {
      const client = this.userPool.addClient(name, {
        userPoolClientName: `${p}-${name}`,
        generateSecret: false,
        authFlows: { userPassword: true, userSrp: true },
        accessTokenValidity: Duration.minutes(60),
        idTokenValidity: Duration.minutes(60),
        refreshTokenValidity: Duration.days(refreshDays),
        enableTokenRevocation: true,
        preventUserExistenceErrors: true,
        disableOAuth: true, // native username/password sign-in only; no hosted UI or redirects
      });
      // Refresh-token rotation (not yet an L2 property): each refresh issues a new
      // refresh token with a full validity period — this is what makes the session slide.
      (client.node.defaultChild as cognito.CfnUserPoolClient).addPropertyOverride('RefreshTokenRotation', {
        Feature: 'ENABLED',
        RetryGracePeriodSeconds: 10,
      });
      return client;
    };

    this.androidClient = sessionClient('android', 7);
    this.adminWebClient = sessionClient('admin-web', 1);

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'AndroidClientId', { value: this.androidClient.userPoolClientId });
    new CfnOutput(this, 'AdminWebClientId', { value: this.adminWebClient.userPoolClientId });
  }
}
