import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import type { DnsConfig, EnvConfig } from './config';

export interface WebStackProps extends StackProps {
  config: EnvConfig;
  /** Present when the swasthyaiq.in hosted zone is configured; then the custom domain is served. */
  dns?: DnsConfig;
  certificate?: acm.ICertificate;
}

/**
 * DIG-34 — admin web on S3 + CloudFront over HTTPS. The site lives under /admin.
 * With the swasthyaiq.in zone configured (DIG-20) it serves the custom domain with a
 * us-east-1 certificate and an alias record; otherwise the default *.cloudfront.net address.
 */
export class WebStack extends Stack {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);
    const { webDomain, envName } = props.config;
    const certificate = props.dns?.hostedZoneId ? props.certificate : undefined;

    this.bucket = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // SPA routing for /admin/*: rewrite deep links to /admin/index.html.
    const spaRewrite = new cloudfront.Function(this, 'AdminSpaRewrite', {
      comment: 'Serve /admin/index.html for client-side routes',
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var r = event.request;
  if (r.uri === '/' ) { r.uri = '/admin/index.html'; return r; }
  if (r.uri.startsWith('/admin') && r.uri.indexOf('.') === -1) { r.uri = '/admin/index.html'; }
  return r;
}`),
    });

    this.distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: `SwasthyaIQ admin web (${envName})`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [
          { function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      domainNames: certificate ? [webDomain] : undefined,
      certificate,
      minimumProtocolVersion: certificate ? cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 : undefined,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // includes India edge locations
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/admin/index.html',
          ttl: Duration.seconds(0),
        },
      ],
    });

    if (certificate && props.dns) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
        hostedZoneId: props.dns.hostedZoneId,
        zoneName: props.dns.zoneName,
      });
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution));
      const recordName = webDomain === props.dns.zoneName ? undefined : webDomain;
      new route53.ARecord(this, 'AliasA', { zone, recordName, target });
      new route53.AaaaRecord(this, 'AliasAAAA', { zone, recordName, target });
    }

    new CfnOutput(this, 'SiteBucket', { value: this.bucket.bucketName });
    new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
    new CfnOutput(this, 'DistributionDomain', {
      value: this.distribution.distributionDomainName,
      description: certificate ? `Served as https://${webDomain}/admin` : 'Custom domain not configured',
    });
  }
}
