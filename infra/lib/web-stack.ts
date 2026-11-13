import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import type { EnvConfig } from './config';

export interface WebStackProps extends StackProps {
  config: EnvConfig;
}

/**
 * DIG-34 — admin web on S3 + CloudFront over HTTPS. The site lives under /admin.
 * The custom domain is attached once DNS (DIG-20) has a validated us-east-1 certificate;
 * until then the default *.cloudfront.net address works.
 */
export class WebStack extends Stack {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);
    const { webDomain, webCertificateArn, envName } = props.config;

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

    const certificate = webCertificateArn
      ? acm.Certificate.fromCertificateArn(this, 'Cert', webCertificateArn)
      : undefined;

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

    new CfnOutput(this, 'SiteBucket', { value: this.bucket.bucketName });
    new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
    new CfnOutput(this, 'DistributionDomain', {
      value: this.distribution.distributionDomainName,
      description: `Point ${webDomain} (CNAME) here`,
    });
  }
}
