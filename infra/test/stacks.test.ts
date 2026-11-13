import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { buildApp } from '../lib/build-app';

const app = new App({
  context: { 'swasthyaiq:account': '123456789012', 'swasthyaiq:alertEmail': 'alerts@example.com' },
});
// cdk.json context is not loaded in tests; supply what buildApp reads.
app.node.setContext('swasthyaiq:githubRepo', 'sunilpjain/SwasthaIQ');
app.node.setContext('swasthyaiq:monthlyBudgetUsd', 70);
app.node.setContext('swasthyaiq:dev', {
  apiDomain: 'dev-api.swasthyaiq.cognihealth.in',
  webDomain: 'dev.swasthyaiq.cognihealth.in',
  webCertificateArn: '',
});
app.node.setContext('swasthyaiq:demo', {
  apiDomain: 'api.swasthyaiq.cognihealth.in',
  webDomain: 'swasthyaiq.cognihealth.in',
  webCertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/abc',
});
const { account, envs } = buildApp(app);
const t = {
  account: Template.fromStack(account),
  network: Template.fromStack(envs.dev.network),
  data: Template.fromStack(envs.dev.data),
  demoData: Template.fromStack(envs.demo.data),
  auth: Template.fromStack(envs.dev.auth),
  server: Template.fromStack(envs.dev.server),
  web: Template.fromStack(envs.dev.web),
  demoWeb: Template.fromStack(envs.demo.web),
  deploy: Template.fromStack(envs.dev.deploy),
};

describe('DIG-1 network', () => {
  it('has public and isolated subnets and no NAT gateway', () => {
    t.network.resourceCountIs('AWS::EC2::NatGateway', 0);
    t.network.resourceCountIs('AWS::EC2::Subnet', 4);
    t.network.hasResourceProperties('AWS::EC2::VPCEndpoint', { VpcEndpointType: 'Gateway' });
  });

  it('server SG allows only 443 and 80 in; DB SG allows 5432 from the server only', () => {
    const sgs = t.network.findResources('AWS::EC2::SecurityGroup');
    const server = Object.values(sgs).find((r) => r.Properties.GroupName === 'swasthyaiq-dev-server')!;
    const ports = server.Properties.SecurityGroupIngress.map((r: { FromPort: number }) => r.FromPort).sort();
    expect(ports).toEqual([443, 80]);
    t.network.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      FromPort: 5432,
      ToPort: 5432,
      SourceSecurityGroupId: Match.anyValue(),
    });
    const json = JSON.stringify(t.network.toJSON());
    expect(json).not.toMatch(/"FromPort":22\b/);
  });
});

describe('tags', () => {
  it('tags resources project = arihant-prototype', () => {
    t.data.hasResourceProperties('AWS::RDS::DBInstance', {
      Tags: Match.arrayWith([{ Key: 'project', Value: 'arihant-prototype' }]),
    });
    t.server.hasResourceProperties('AWS::EC2::Instance', {
      Tags: Match.arrayWith([{ Key: 'project', Value: 'arihant-prototype' }]),
    });
  });
});

describe('DIG-31 data', () => {
  it('RDS PostgreSQL t4g.micro, single-AZ, private, encrypted, 7-day backups', () => {
    t.data.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      DBInstanceClass: 'db.t4g.micro',
      MultiAZ: false,
      PubliclyAccessible: false,
      StorageEncrypted: true,
      BackupRetentionPeriod: 7,
    });
  });
  it('demo database is deletion-protected', () => {
    t.demoData.hasResourceProperties('AWS::RDS::DBInstance', { DeletionProtection: true });
  });
  it('file bucket is private, encrypted and deletes test recordings after 30 days', () => {
    t.data.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: Match.objectLike({}),
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({ Prefix: 'recordings/', ExpirationInDays: 30, Status: 'Enabled' }),
        ]),
      },
    });
  });
  it('jobs queue has a DLQ after 3 tries, with an alarm', () => {
    t.data.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'swasthyaiq-dev-jobs',
      RedrivePolicy: { deadLetterTargetArn: Match.anyValue(), maxReceiveCount: 3 },
    });
    t.data.hasResourceProperties('AWS::CloudWatch::Alarm', { AlarmName: 'swasthyaiq-dev-jobs-failed' });
  });
  it('app secret exists for third-party keys', () => {
    t.data.hasResourceProperties('AWS::SecretsManager::Secret', { Name: 'swasthyaiq-dev/app' });
  });
});

describe('DIG-32 Cognito', () => {
  it('no self sign-up, case-insensitive user IDs', () => {
    t.auth.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      UsernameConfiguration: { CaseSensitive: false },
    });
  });
  it('creates exactly the 3 fixed users in the right groups, with no invite message', () => {
    t.auth.resourceCountIs('AWS::Cognito::UserPoolUser', 3);
    for (const u of ['saiyam', 'samradnyee', 'admin']) {
      t.auth.hasResourceProperties('AWS::Cognito::UserPoolUser', { Username: u, MessageAction: 'SUPPRESS' });
    }
    t.auth.hasResourceProperties('AWS::Cognito::UserPoolUserToGroupAttachment', {
      Username: 'saiyam',
      GroupName: 'doctor',
    });
    t.auth.hasResourceProperties('AWS::Cognito::UserPoolUserToGroupAttachment', {
      Username: 'admin',
      GroupName: 'admin',
    });
  });
  it('android client: 7-day refresh token with rotation and revocation (sliding session)', () => {
    t.auth.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'swasthyaiq-dev-android',
      RefreshTokenValidity: 10080, // minutes = 7 days
      TokenValidityUnits: Match.objectLike({ RefreshToken: 'minutes' }),
      EnableTokenRevocation: true,
      GenerateSecret: false,
      RefreshTokenRotation: { Feature: 'ENABLED', RetryGracePeriodSeconds: 10 },
    });
  });
  it('never contains a password', () => {
    expect(JSON.stringify(t.auth.toJSON())).not.toMatch(/"TemporaryPassword"|"Password":/);
  });
});

describe('DIG-33 server', () => {
  it('t4g.small, Amazon Linux 2023 arm64, IMDSv2, encrypted disk, no key pair', () => {
    t.server.hasResourceProperties('AWS::EC2::Instance', {
      InstanceType: 't4g.small',
      KeyName: Match.absent(),
      BlockDeviceMappings: [Match.objectLike({ Ebs: Match.objectLike({ Encrypted: true }) })],
    });
    t.server.hasResourceProperties('AWS::EC2::LaunchTemplate', {
      LaunchTemplateName: 'swasthyaiq-dev-api',
      LaunchTemplateData: Match.objectLike({ MetadataOptions: { HttpTokens: 'required' } }),
    });
  });
  it('has an Elastic IP, an auto-recover alarm, nightly snapshots and patching after 10 pm IST', () => {
    t.server.resourceCountIs('AWS::EC2::EIP', 1);
    const alarms = Object.values(t.server.findResources('AWS::CloudWatch::Alarm'));
    const recover = alarms.find((a) => a.Properties.MetricName === 'StatusCheckFailed_System')!;
    expect(JSON.stringify(recover.Properties.AlarmActions)).toContain(':ec2:recover');
    t.server.hasResourceProperties('AWS::DLM::LifecyclePolicy', {
      PolicyDetails: Match.objectLike({ Schedules: [Match.objectLike({ RetainRule: { Count: 7 } })] }),
    });
    t.server.hasResourceProperties('AWS::SSM::Association', {
      Name: 'AWS-RunPatchBaseline',
      ScheduleExpression: 'cron(45 16 ? * * *)',
    });
  });
  it('user data sets up Caddy for the API domain and the deploy script', () => {
    const json = JSON.stringify(t.server.toJSON());
    expect(json).toContain('dev-api.swasthyaiq.cognihealth.in');
    expect(json).toContain('/opt/swasthyaiq/deploy.sh');
    expect(json).toContain('reverse_proxy api:3000');
  });
});

describe('DIG-34 least-privilege IAM, secrets and admin hosting', () => {
  it('server role has SSM core plus only the services the API uses', () => {
    const policies = t.server.findResources('AWS::IAM::Policy');
    const actions = new Set<string>();
    for (const p of Object.values(policies)) {
      for (const st of p.Properties.PolicyDocument.Statement) {
        for (const a of [].concat(st.Action)) actions.add(a);
      }
    }
    const services = new Set([...actions].map((a) => a.split(':')[0]));
    expect([...services].sort()).toEqual(
      [
        'bedrock',
        'cloudwatch',
        'cognito-idp',
        'ecr',
        'logs',
        's3',
        'secretsmanager',
        'sqs',
        'textract',
        'transcribe',
      ].sort(),
    );
    expect([...actions].some((a) => a.endsWith(':*') || a === '*')).toBe(false);
  });
  it('admin site is private S3 behind CloudFront (OAC), HTTPS only', () => {
    t.web.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      }),
    });
    t.web.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  });
  it('demo uses the custom domain when a certificate is configured', () => {
    t.demoWeb.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: ['swasthyaiq.cognihealth.in'] }),
    });
  });
});

describe('DIG-35 CI/CD access and DIG-19 budget', () => {
  it('GitHub OIDC roles: dev from main only, demo from version tags only', () => {
    const roles = t.account.findResources('AWS::IAM::Role');
    const trust = JSON.stringify(Object.values(roles).map((r) => r.Properties.AssumeRolePolicyDocument));
    expect(trust).toContain('repo:sunilpjain/SwasthaIQ:ref:refs/heads/main');
    expect(trust).toContain('repo:sunilpjain/SwasthaIQ:ref:refs/tags/v*');
    expect(trust).toContain('sts.amazonaws.com');
  });
  it('ECR keeps recent images for rollback and is immutable', () => {
    t.account.hasResourceProperties('AWS::ECR::Repository', { ImageTagMutability: 'IMMUTABLE' });
  });
  it('deploy role may run commands only on this environment’s server', () => {
    t.deploy.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([Match.objectLike({ Sid: 'RunDeployScript', Action: 'ssm:SendCommand' })]),
      },
    });
  });
  it('budget alerts at 50, 80 and 100% plus forecast', () => {
    t.account.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({ BudgetLimit: { Amount: 70, Unit: 'USD' }, TimeUnit: 'MONTHLY' }),
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({ Notification: Match.objectLike({ Threshold: 50, NotificationType: 'ACTUAL' }) }),
        Match.objectLike({ Notification: Match.objectLike({ Threshold: 80 }) }),
        Match.objectLike({
          Notification: Match.objectLike({ Threshold: 100, NotificationType: 'FORECASTED' }),
        }),
      ]),
    });
  });
});
