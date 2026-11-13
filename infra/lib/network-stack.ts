import { Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';
import { prefix, type EnvConfig } from './config';

export interface NetworkStackProps extends StackProps {
  config: EnvConfig;
}

/**
 * DIG-1 — network baseline. Public subnets for the app server, isolated subnets for RDS.
 * No NAT gateway: the server has a public IP for outbound calls; the database has no internet.
 */
export class NetworkStack extends Stack {
  readonly vpc: ec2.Vpc;
  readonly serverSg: ec2.SecurityGroup;
  readonly dbSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);
    const p = prefix(props.config.envName);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${p}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(props.config.envName === 'dev' ? '10.40.0.0/16' : '10.41.0.0/16'),
      // Two AZs because RDS subnet groups need them even for a single-AZ instance.
      // Named explicitly so synth needs no AWS lookup.
      availabilityZones: ['ap-south-1a', 'ap-south-1b'],
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'data', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
    // Free gateway endpoint so the server reaches S3 without leaving the AWS network.
    this.vpc.addGatewayEndpoint('S3Endpoint', { service: ec2.GatewayVpcEndpointAwsService.S3 });

    this.serverSg = new ec2.SecurityGroup(this, 'ServerSg', {
      vpc: this.vpc,
      securityGroupName: `${p}-server`,
      description: 'App server: HTTPS in (and HTTP for certificate renewal). No SSH.',
      allowAllOutbound: true,
    });
    this.serverSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    this.serverSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP for ACME / redirect');

    this.dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      securityGroupName: `${p}-db`,
      description: 'PostgreSQL from the app server only',
      allowAllOutbound: false,
    });
    this.dbSg.addIngressRule(this.serverSg, ec2.Port.tcp(5432), 'PostgreSQL from app server');
  }
}
