import { Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import type { DnsConfig, EnvConfig } from './config';

export interface CertStackProps extends StackProps {
  config: EnvConfig;
  dns: DnsConfig;
}

/**
 * DIG-20 — CloudFront certificates must live in us-east-1. DNS-validated in the
 * swasthyaiq.in hosted zone, so issuance and renewal are automatic.
 */
export class CertStack extends Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertStackProps) {
    super(scope, id, props);
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.dns.hostedZoneId,
      zoneName: props.dns.zoneName,
    });
    this.certificate = new acm.Certificate(this, 'WebCert', {
      domainName: props.config.webDomain,
      validation: acm.CertificateValidation.fromDns(zone),
    });
  }
}
