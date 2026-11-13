import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import type { Construct } from 'constructs';
import type { EnvName } from './config';

export interface AccountStackProps extends StackProps {
  githubRepo: string; // owner/name
  alertEmail: string;
  monthlyBudgetUsd: number;
}

export const deployRoleName = (env: EnvName): string => `swasthyaiq-github-deploy-${env}`;

/**
 * Shared, account-level resources (deployed once):
 * - ECR repository for API images (keeps recent images so rollback is one command)
 * - GitHub OIDC provider and one deploy role per environment (DIG-35, no long-lived keys)
 * - alarm topic and the ₹6,000/month budget alerts at 50/80/100% (DIG-19)
 */
export class AccountStack extends Stack {
  readonly repository: ecr.Repository;
  readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: AccountStackProps) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, 'ApiRepo', {
      repositoryName: 'swasthyaiq-api',
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      lifecycleRules: [{ description: 'keep the last 20 images', maxImageCount: 20 }],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.alarmTopic = new sns.Topic(this, 'Alarms', { topicName: 'swasthyaiq-alarms' });
    if (props.alertEmail) this.alarmTopic.addSubscription(new subs.EmailSubscription(props.alertEmail));

    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const subjects: Record<EnvName, string[]> = {
      dev: [`repo:${props.githubRepo}:ref:refs/heads/main`],
      demo: [`repo:${props.githubRepo}:ref:refs/tags/v*`],
    };
    for (const env of ['dev', 'demo'] as const) {
      const role = new iam.Role(this, `DeployRole-${env}`, {
        roleName: deployRoleName(env),
        description: `GitHub Actions deploys to ${env}`,
        maxSessionDuration: Duration.hours(1),
        assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
          StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
          StringLike: { 'token.actions.githubusercontent.com:sub': subjects[env] },
        }),
      });
      this.repository.grantPullPush(role);
      role.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }));
      role.addToPolicy(
        new iam.PolicyStatement({
          sid: 'ReadStackOutputs',
          actions: ['cloudformation:DescribeStacks'],
          resources: [`arn:aws:cloudformation:${this.region}:${this.account}:stack/SwasthyaIQ-${env}-*/*`],
        }),
      );
    }

    if (props.monthlyBudgetUsd > 0) {
      const subscribers = props.alertEmail ? [{ subscriptionType: 'EMAIL', address: props.alertEmail }] : [];
      const note = (type: 'ACTUAL' | 'FORECASTED', threshold: number) => ({
        notification: {
          notificationType: type,
          comparisonOperator: 'GREATER_THAN',
          threshold,
          thresholdType: 'PERCENTAGE',
        },
        subscribers,
      });
      new budgets.CfnBudget(this, 'MonthlyBudget', {
        budget: {
          budgetName: 'swasthyaiq-arihant-prototype',
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: props.monthlyBudgetUsd, unit: 'USD' }, // ≈ ₹6,000
          costFilters: { TagKeyValue: ['user:project$arihant-prototype'] },
        },
        notificationsWithSubscribers: subscribers.length
          ? [note('ACTUAL', 50), note('ACTUAL', 80), note('ACTUAL', 100), note('FORECASTED', 100)]
          : [],
      });
    }

    new CfnOutput(this, 'EcrRepositoryUri', { value: this.repository.repositoryUri });
    new CfnOutput(this, 'DeployRoleDevArn', {
      value: `arn:aws:iam::${this.account}:role/${deployRoleName('dev')}`,
    });
    new CfnOutput(this, 'DeployRoleDemoArn', {
      value: `arn:aws:iam::${this.account}:role/${deployRoleName('demo')}`,
    });
  }
}
