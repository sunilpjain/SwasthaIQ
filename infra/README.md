# infra — AWS CDK for the SwasthyaIQ Arihant prototype

Region **ap-south-1 (Mumbai)**. Two environments, **dev** and **demo**, plus one shared account stack. Every resource is tagged `project = arihant-prototype`.

| Stack                           | Story          | What                                                                                                                                                                                  |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SwasthyaIQ-Account`            | DIG-19, DIG-35 | ECR repo `swasthyaiq-api`, GitHub OIDC + deploy roles (dev ← `main`, demo ← tags `v*`), alarm topic, monthly budget alerts (50 / 80 / 100 % + forecast)                               |
| `SwasthyaIQ-<env>-Network`      | DIG-1          | VPC, public + isolated subnets, **no NAT**, S3 gateway endpoint, security groups (server 443/80 in; DB 5432 from server only)                                                         |
| `SwasthyaIQ-<env>-Data`         | DIG-31         | RDS PostgreSQL 16 db.t4g.micro single-AZ encrypted (7-day backups), private file bucket (recordings deleted after 30 days), SQS jobs queue + DLQ (3 tries) with alarm, `…/app` secret |
| `SwasthyaIQ-<env>-Auth`         | DIG-32         | Cognito pool, users `saiyam`, `samradnyee` (doctor) and `admin` (admin); android client with 7-day rotating refresh token                                                             |
| `SwasthyaIQ-<env>-Server`       | DIG-33, DIG-34 | EC2 t4g.small AL2023 arm64, Elastic IP, Docker + Caddy (HTTPS), SSM only (no SSH), auto-recover alarm, nightly snapshot ×7, patching 22:15 IST, least-privilege role                  |
| `SwasthyaIQ-<env>-Web`          | DIG-34         | Admin web on private S3 + CloudFront (OAC) at `/admin`                                                                                                                                |
| `SwasthyaIQ-<env>-DeployAccess` | DIG-35         | Lets that env's GitHub role run `deploy.sh` via SSM, publish the admin web and invalidate CloudFront                                                                                  |

## Before the first deploy (Sprint 0 items)

1. **AWS access (DIG-19):** an IAM Identity Center user or admin role for the builder in Cognihealth's account; `aws sso login` works locally.
2. Put the account id and alert email in `cdk.json` → `swasthyaiq:account`, `swasthyaiq:alertEmail` (or pass `-c` on the command line).
3. Turn on the cost-allocation tag `project` in Billing → Cost allocation tags (needed for the budget filter).
4. Bootstrap once: `npx cdk bootstrap aws://<account>/ap-south-1`.

## Deploy

```bash
cd infra
pnpm deploy:account          # once
pnpm deploy:dev              # all dev stacks
pnpm deploy:demo             # all demo stacks (after G3; demo is the doctors' environment)
```

Outputs you will need:

- `Server.ElasticIp` → create the **A record** for the API domain (`dev-api.swasthyaiq.cognihealth.in` / `api.swasthyaiq.cognihealth.in`). Caddy gets its certificate automatically once DNS resolves.
- `Web.DistributionDomain` → **CNAME** for the web domain. To serve the custom domain, request an ACM certificate **in us-east-1** for it, validate by DNS, put its ARN in `cdk.json` → `webCertificateArn`, and redeploy the Web stack.
- `Auth.UserPoolId`, `Auth.AndroidClientId`, `Auth.AdminWebClientId` → app and admin-web config.
- Set the GitHub repository variable **`AWS_ACCOUNT_ID`** so `.github/workflows/deploy.yml` can assume the deploy roles.

## Set the three passwords (never in code, docs or chat)

Passwords are fixed and shared privately with each user. Run once per user, per environment:

```bash
read -s -p "Password for saiyam: " PW && echo
aws cognito-idp admin-set-user-password --user-pool-id <UserPoolId> --username saiyam --password "$PW" --permanent
unset PW
```

Repeat for `samradnyee` and `admin`. Minimum 12 characters with upper, lower and a digit.

## Put the Sarvam key in Secrets Manager

```bash
aws secretsmanager put-secret-value --secret-id swasthyaiq-dev/app \
  --secret-string "{\"sarvamApiKey\":\"$(read -s -p 'Sarvam key: ' k && echo $k)\"}"
```

The API reads it at start-up; restart with `deploy.sh <current tag>` after changing it.

## Server operations

- Shell: `aws ssm start-session --target <InstanceId>` (no SSH, port 22 closed).
- Deploy a tag by hand: `sudo /opt/swasthyaiq/deploy.sh <tag>`.
- **Roll back in one command:** `sudo /opt/swasthyaiq/deploy.sh --rollback` (or run the _deploy_ workflow with "rollback" ticked). The previous tag is kept in `/opt/swasthyaiq/previous-tag`; ECR keeps the last 20 images.
- Logs: CloudWatch log group `/swasthyaiq-<env>/api`.

## Cost guard-rails

Budget about ₹6,000 / month (`monthlyBudgetUsd: 70`). No NAT gateway, no load balancer, single-AZ RDS. Check the budget before changing any of these.
