import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AspectPriority,
  Aspects,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dlm from 'aws-cdk-lib/aws-dlm';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import type * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct, IConstruct } from 'constructs';
import { prefix, REGION, type DnsConfig, type EnvConfig } from './config';

export interface ServerStackProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  serverSg: ec2.ISecurityGroup;
  repository: ecr.IRepository;
  filesBucket: s3.IBucket;
  jobsQueue: sqs.IQueue;
  dbSecret: secretsmanager.ISecret;
  appSecret: secretsmanager.ISecret;
  userPoolId: string;
  appClientIds: string[];
  alarmTopic?: sns.ITopic;
  dns?: DnsConfig;
}

const asset = (name: string): string => readFileSync(join(__dirname, '..', 'assets', 'server', name), 'utf8');

/**
 * DIG-33 — one always-on EC2 t4g.small (no load balancer) running the API in Docker behind Caddy.
 * DIG-34 (part) — the server's least-privilege IAM role.
 */
export class ServerStack extends Stack {
  readonly instance: ec2.Instance;
  readonly role: iam.Role;
  readonly eip: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props: ServerStackProps) {
    super(scope, id, props);
    const env = props.config.envName;
    const p = prefix(env);

    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: `/${p}/api`,
      retention: logs.RetentionDays.ONE_MONTH,
      // Dev logs go with the stack (so a failed first deploy can be retried); demo keeps them.
      removalPolicy: env === 'demo' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // ---------------------------------------------------------------- IAM (least privilege)
    this.role = new iam.Role(this, 'ServerRole', {
      roleName: `${p}-server`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'SwasthyaIQ API server: only the services the API uses',
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });
    props.filesBucket.grantReadWrite(this.role);
    props.jobsQueue.grantSendMessages(this.role);
    props.jobsQueue.grantConsumeMessages(this.role);
    props.dbSecret.grantRead(this.role);
    props.appSecret.grantRead(this.role);
    props.repository.grantPull(this.role);
    logGroup.grantWrite(this.role);
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'Bedrock',
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
          'bedrock:Converse',
          'bedrock:ConverseStream',
        ],
        resources: [
          `arn:aws:bedrock:${REGION}::foundation-model/*`,
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
          'arn:aws:bedrock:*::foundation-model/*', // cross-region inference profiles route to other regions' models
        ],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'TextractAndTranscribe',
        // These services do not support resource-level permissions.
        actions: [
          'textract:DetectDocumentText',
          'textract:AnalyzeDocument',
          'textract:StartDocumentAnalysis',
          'textract:GetDocumentAnalysis',
          'transcribe:StartStreamTranscription',
          'transcribe:StartStreamTranscriptionWebSocket',
        ],
        resources: ['*'],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'RemoteSignOut',
        actions: [
          'cognito-idp:AdminUserGlobalSignOut',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminEnableUser',
        ],
        resources: [`arn:aws:cognito-idp:${REGION}:${this.account}:userpool/${props.userPoolId}`],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'Metrics',
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: { StringEquals: { 'cloudwatch:namespace': 'SwasthyaIQ' } },
      }),
    );

    // ---------------------------------------------------------------- instance
    const envFile = [
      `APP_ENV=${env}`,
      `AWS_REGION=${REGION}`,
      `PORT=3000`,
      `API_DOMAIN=${props.config.apiDomain}`,
      `ECR_REPO=${props.repository.repositoryUri}`,
      `API_IMAGE=${props.repository.repositoryUri}:bootstrap`,
      `LOG_GROUP=${logGroup.logGroupName}`,
      `DB_SECRET_ARN=${props.dbSecret.secretArn}`,
      `APP_SECRET_ARN=${props.appSecret.secretArn}`,
      `COGNITO_USER_POOL_ID=${props.userPoolId}`,
      `COGNITO_APP_CLIENT_IDS=${props.appClientIds.join(',')}`,
      `FILES_BUCKET=${props.filesBucket.bucketName}`,
      `JOBS_QUEUE_URL=${props.jobsQueue.queueUrl}`,
    ].join('\n');

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euxo pipefail',
      'dnf install -y docker cronie',
      'mkdir -p /usr/local/lib/docker/cli-plugins',
      'curl -fsSL https://github.com/docker/compose/releases/download/v2.32.1/docker-compose-linux-aarch64 -o /usr/local/lib/docker/cli-plugins/docker-compose',
      'chmod +x /usr/local/lib/docker/cli-plugins/docker-compose',
      'systemctl enable --now docker',
      'mkdir -p /opt/swasthyaiq',
      `cat > /opt/swasthyaiq/.env <<'EOF'\n${envFile}\nEOF`,
      `cat > /opt/swasthyaiq/Caddyfile <<'EOF'\n${asset('Caddyfile')}EOF`,
      `cat > /opt/swasthyaiq/docker-compose.yml <<'EOF'\n${asset('docker-compose.yml')}EOF`,
      `cat > /opt/swasthyaiq/deploy.sh <<'EOF'\n${asset('deploy.sh')}EOF`,
      'chmod 600 /opt/swasthyaiq/.env && chmod 750 /opt/swasthyaiq/deploy.sh',
      // First boot: Caddy only; the API starts on the first CI deploy (deploy.sh <tag>).
      'cd /opt/swasthyaiq && docker compose up -d caddy || true',
    );

    this.instance = new ec2.Instance(this, 'Server', {
      instanceName: `${p}-api`,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: props.serverSg,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
      role: this.role,
      userData,
      // A config change (e.g. the API domain) rebuilds the server; it holds no data, and the EIP moves over.
      userDataCausesReplacement: true,
      requireImdsv2: true,
      associatePublicIpAddress: true,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(20, { encrypted: true, volumeType: ec2.EbsDeviceVolumeType.GP3 }),
        },
      ],
      // No key pair: access is through SSM Session Manager only.
    });
    // Launch template names are account-wide; make dev and demo distinct.
    // The IMDSv2 launch template is added by an aspect at synth time, so rename it the same way.
    const ltName = `${p}-api`;
    Aspects.of(this).add(
      {
        visit(node: IConstruct): void {
          // Rename the template and the instance's reference to it together.
          if (node instanceof ec2.CfnLaunchTemplate) node.addPropertyOverride('LaunchTemplateName', ltName);
          if (node instanceof ec2.CfnInstance)
            node.addPropertyOverride('LaunchTemplate.LaunchTemplateName', ltName);
        },
      },
      { priority: AspectPriority.READONLY },
    );
    Tags.of(this.instance).add('swasthyaiq:snapshot', 'daily');
    Tags.of(this.instance).add('swasthyaiq:env', env);

    this.eip = new ec2.CfnEIP(this, 'Eip', { domain: 'vpc', instanceId: this.instance.instanceId });

    // ---------------------------------------------------------------- resilience
    // EC2 automatic recovery when the underlying host fails.
    const recover = new cloudwatch.Alarm(this, 'AutoRecover', {
      alarmName: `${p}-api-auto-recover`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'StatusCheckFailed_System',
        dimensionsMap: { InstanceId: this.instance.instanceId },
        statistic: 'Maximum',
        period: Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });
    recover.addAlarmAction(new cwActions.Ec2Action(cwActions.Ec2InstanceAction.RECOVER));

    const cpu = new cloudwatch.Alarm(this, 'HighCpu', {
      alarmName: `${p}-api-cpu-high`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'CPUUtilization',
        dimensionsMap: { InstanceId: this.instance.instanceId },
        period: Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
    });
    if (props.alarmTopic) {
      const notify = new cwActions.SnsAction(props.alarmTopic);
      recover.addAlarmAction(notify);
      cpu.addAlarmAction(notify);
    }

    // Nightly EBS snapshot at ~23:00 IST, 7 kept.
    const dlmRole = new iam.Role(this, 'DlmRole', {
      assumedBy: new iam.ServicePrincipal('dlm.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSDataLifecycleManagerServiceRole'),
      ],
    });
    new dlm.CfnLifecyclePolicy(this, 'NightlySnapshots', {
      description: `${p} nightly server snapshot keep 7`,
      state: 'ENABLED',
      executionRoleArn: dlmRole.roleArn,
      policyDetails: {
        resourceTypes: ['INSTANCE'],
        targetTags: [{ key: 'swasthyaiq:env', value: env }],
        schedules: [
          {
            name: 'nightly',
            createRule: { cronExpression: 'cron(30 17 * * ? *)' }, // 17:30 UTC = 23:00 IST
            retainRule: { count: 7 },
            copyTags: true,
          },
        ],
      },
    });

    // OS patches after 10 pm IST, nightly.
    new ssm.CfnAssociation(this, 'NightlyPatching', {
      name: 'AWS-RunPatchBaseline',
      associationName: `${p}-patching`,
      scheduleExpression: 'cron(45 16 ? * * *)', // 16:45 UTC = 22:15 IST
      parameters: { Operation: ['Install'], RebootOption: ['RebootIfNeeded'] },
      targets: [{ key: 'InstanceIds', values: [this.instance.instanceId] }],
    });

    if (props.dns?.hostedZoneId) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
        hostedZoneId: props.dns.hostedZoneId,
        zoneName: props.dns.zoneName,
      });
      new route53.ARecord(this, 'ApiRecord', {
        zone,
        recordName: props.config.apiDomain,
        target: route53.RecordTarget.fromIpAddresses(this.eip.ref),
        ttl: Duration.minutes(5),
      });
    }

    new CfnOutput(this, 'InstanceId', { value: this.instance.instanceId });
    new CfnOutput(this, 'ElasticIp', {
      value: this.eip.ref,
      description: `${props.config.apiDomain} points here`,
    });
  }
}
