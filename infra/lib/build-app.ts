import { Tags, type App, type Environment } from 'aws-cdk-lib';
import { AccountStack } from './account-stack';
import { AuthStack } from './auth-stack';
import { PROJECT_TAG, REGION, type EnvConfig, type EnvName } from './config';
import { DataStack } from './data-stack';
import { DeployAccessStack } from './deploy-access-stack';
import { NetworkStack } from './network-stack';
import { ServerStack } from './server-stack';
import { WebStack } from './web-stack';

export interface BuiltEnv {
  network: NetworkStack;
  data: DataStack;
  auth: AuthStack;
  server: ServerStack;
  web: WebStack;
  deploy: DeployAccessStack;
}

/** Wires every stack. Used by bin/app.ts and by the assertion tests. */
export function buildApp(app: App): { account: AccountStack; envs: Record<EnvName, BuiltEnv> } {
  const accountId =
    (app.node.tryGetContext('swasthyaiq:account') as string) || process.env.CDK_DEFAULT_ACCOUNT;
  const env: Environment = { account: accountId, region: REGION };
  if (accountId) {
    // Mumbai's AZs, pinned so synth never needs AWS credentials (CI, tests).
    const key = `availability-zones:account=${accountId}:region=${REGION}`;
    if (!app.node.tryGetContext(key)) app.node.setContext(key, ['ap-south-1a', 'ap-south-1b', 'ap-south-1c']);
  }

  const account = new AccountStack(app, 'SwasthyaIQ-Account', {
    env,
    githubRepo: app.node.tryGetContext('swasthyaiq:githubRepo') as string,
    alertEmail: (app.node.tryGetContext('swasthyaiq:alertEmail') as string) ?? '',
    monthlyBudgetUsd: Number(app.node.tryGetContext('swasthyaiq:monthlyBudgetUsd') ?? 0),
  });

  const build = (envName: EnvName): BuiltEnv => {
    const ctx = app.node.tryGetContext(`swasthyaiq:${envName}`) as Omit<EnvConfig, 'envName'>;
    const config: EnvConfig = { envName, ...ctx };
    const id = (s: string) => `SwasthyaIQ-${envName}-${s}`;

    const network = new NetworkStack(app, id('Network'), { env, config });
    const data = new DataStack(app, id('Data'), {
      env,
      config,
      vpc: network.vpc,
      dbSg: network.dbSg,
      alarmTopic: account.alarmTopic,
    });
    const auth = new AuthStack(app, id('Auth'), { env, config });
    const server = new ServerStack(app, id('Server'), {
      env,
      config,
      vpc: network.vpc,
      serverSg: network.serverSg,
      repository: account.repository,
      filesBucket: data.filesBucket,
      jobsQueue: data.jobsQueue,
      dbSecret: data.dbSecret,
      appSecret: data.appSecret,
      userPoolId: auth.userPool.userPoolId,
      appClientIds: [auth.androidClient.userPoolClientId, auth.adminWebClient.userPoolClientId],
      alarmTopic: account.alarmTopic,
    });
    const web = new WebStack(app, id('Web'), { env, config });
    const deploy = new DeployAccessStack(app, id('DeployAccess'), {
      env,
      config,
      instanceId: server.instance.instanceId,
      siteBucket: web.bucket,
      distributionId: web.distribution.distributionId,
    });
    deploy.addStackDependency(account);
    return { network, data, auth, server, web, deploy };
  };

  const envs = { dev: build('dev'), demo: build('demo') };
  Tags.of(app).add(PROJECT_TAG.key, PROJECT_TAG.value);
  return { account, envs };
}
