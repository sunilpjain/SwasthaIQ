import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';
import { prefix, type EnvConfig } from './config';

export interface DataStackProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  dbSg: ec2.ISecurityGroup;
  alarmTopic?: sns.ITopic;
}

/**
 * DIG-31 — RDS PostgreSQL, the private file bucket and the background-job queue.
 * DIG-34 (part) — the app secret for third-party keys (Sarvam), filled in by hand after deploy.
 */
export class DataStack extends Stack {
  readonly db: rds.DatabaseInstance;
  readonly dbSecret: secretsmanager.ISecret;
  readonly appSecret: secretsmanager.Secret;
  readonly filesBucket: s3.Bucket;
  readonly jobsQueue: sqs.Queue;
  readonly jobsDlq: sqs.Queue;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const p = prefix(props.config.envName);

    this.db = new rds.DatabaseInstance(this, 'Postgres', {
      instanceIdentifier: `${p}-db`,
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.dbSg],
      multiAz: false,
      publiclyAccessible: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      databaseName: 'swasthyaiq',
      credentials: rds.Credentials.fromGeneratedSecret('swasthyaiq', { secretName: `${p}/db` }),
      backupRetention: Duration.days(7),
      preferredBackupWindow: '19:30-20:00', // 01:00–01:30 IST
      preferredMaintenanceWindow: 'sun:17:00-sun:17:30', // Sun 22:30 IST
      autoMinorVersionUpgrade: true,
      deletionProtection: props.config.envName === 'demo',
      removalPolicy: props.config.envName === 'demo' ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
      cloudwatchLogsExports: ['postgresql'],
    });
    this.dbSecret = this.db.secret!;

    this.appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      secretName: `${p}/app`,
      description: 'Third-party API keys for the API server. Set sarvamApiKey by hand after first deploy.',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ sarvamApiKey: 'SET-ME' }),
        generateStringKey: 'unused',
      },
    });

    this.filesBucket = new s3.Bucket(this, 'Files', {
      bucketName: undefined, // generated, so dev and demo never collide
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        // Test recordings (accuracy testing only) are kept 30 days, then deleted.
        { id: 'delete-test-recordings', prefix: 'recordings/', expiration: Duration.days(30) },
        { id: 'abort-incomplete-uploads', abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
      removalPolicy: props.config.envName === 'demo' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.config.envName !== 'demo',
    });

    this.jobsDlq = new sqs.Queue(this, 'JobsDlq', {
      queueName: `${p}-jobs-dlq`,
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });
    this.jobsQueue = new sqs.Queue(this, 'Jobs', {
      queueName: `${p}-jobs`,
      visibilityTimeout: Duration.minutes(5),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      deadLetterQueue: { queue: this.jobsDlq, maxReceiveCount: 3 },
    });

    // A job that failed 3 times lands in the DLQ: alert the admin.
    const failedJobs = new cloudwatch.Alarm(this, 'FailedJobs', {
      alarmName: `${p}-jobs-failed`,
      metric: this.jobsDlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const dbCpu = this.db.metricCPUUtilization({ period: Duration.minutes(5) }).createAlarm(this, 'DbCpu', {
      alarmName: `${p}-db-cpu-high`,
      threshold: 80,
      evaluationPeriods: 3,
    });
    if (props.alarmTopic) {
      failedJobs.addAlarmAction(new cwActions.SnsAction(props.alarmTopic));
      dbCpu.addAlarmAction(new cwActions.SnsAction(props.alarmTopic));
    }
  }
}
