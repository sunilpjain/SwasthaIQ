import { Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { deployRoleName } from './account-stack';
import type { EnvConfig } from './config';

export interface DeployAccessStackProps extends StackProps {
  config: EnvConfig;
  instanceId: string;
  siteBucket: s3.IBucket;
  distributionId: string;
}

/**
 * DIG-35 — what this environment's GitHub deploy role may do: run deploy.sh on this
 * environment's server through SSM, publish the admin web and invalidate CloudFront.
 */
export class DeployAccessStack extends Stack {
  constructor(scope: Construct, id: string, props: DeployAccessStackProps) {
    super(scope, id, props);
    const role = iam.Role.fromRoleName(this, 'DeployRole', deployRoleName(props.config.envName), {
      mutable: true,
    });
    const instanceArn = `arn:aws:ec2:${this.region}:${this.account}:instance/${props.instanceId}`;

    const policy = new iam.Policy(this, 'DeployAccess', {
      statements: [
        new iam.PolicyStatement({
          sid: 'RunDeployScript',
          actions: ['ssm:SendCommand'],
          resources: [instanceArn, `arn:aws:ssm:${this.region}::document/AWS-RunShellScript`],
        }),
        new iam.PolicyStatement({
          sid: 'ReadCommandResult',
          actions: ['ssm:GetCommandInvocation', 'ssm:ListCommandInvocations'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'Invalidate',
          actions: ['cloudfront:CreateInvalidation'],
          resources: [`arn:aws:cloudfront::${this.account}:distribution/${props.distributionId}`],
        }),
      ],
    });
    policy.addStatements(
      new iam.PolicyStatement({
        sid: 'PublishAdminWeb',
        actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [props.siteBucket.bucketArn, props.siteBucket.arnForObjects('*')],
      }),
    );
    policy.attachToRole(role);
  }
}
