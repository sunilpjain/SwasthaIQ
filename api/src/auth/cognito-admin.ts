import {
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';

/** Admin operations on the Cognito user pool. Swapped for a fake in tests. */
export abstract class CognitoAdmin {
  /** Revokes every refresh token the user holds, forcing a password login. */
  abstract globalSignOut(username: string): Promise<void>;
  abstract setEnabled(username: string, enabled: boolean): Promise<void>;
}

export class AwsCognitoAdmin extends CognitoAdmin {
  private readonly client: CognitoIdentityProviderClient;

  constructor(
    private readonly userPoolId: string,
    region: string,
  ) {
    super();
    this.client = new CognitoIdentityProviderClient({ region });
  }

  async globalSignOut(username: string): Promise<void> {
    await this.client.send(
      new AdminUserGlobalSignOutCommand({ UserPoolId: this.userPoolId, Username: username }),
    );
  }

  async setEnabled(username: string, enabled: boolean): Promise<void> {
    const input = { UserPoolId: this.userPoolId, Username: username };
    await this.client.send(enabled ? new AdminEnableUserCommand(input) : new AdminDisableUserCommand(input));
  }
}
