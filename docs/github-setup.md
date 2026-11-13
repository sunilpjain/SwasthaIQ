# GitHub setup (one-off, DIG-18 / DIG-35)

1. **Push the branch** and open a PR from `sprint-1/foundation` into `main`. The first CI run must pass (DIG-18 acceptance).
2. **Branch protection on `main`** (Settings → Branches → Add rule):
   - Require a pull request before merging (1 approval once the reviewer is on the repo)
   - Require status checks to pass: **`ci`**
   - Require branches to be up to date before merging
   - Do not allow bypassing the above settings
3. **Repository variable** (Settings → Secrets and variables → Actions → Variables): `AWS_ACCOUNT_ID` = Cognihealth's AWS account id. No AWS keys are stored in GitHub; deploys use OIDC roles from the `SwasthyaIQ-Account` stack.
4. **Environments (optional):** add a `demo` environment with a required reviewer if you want a second click before demo deploys.
5. **Claude GitHub App** (optional): install at github.com/apps/claude on this repo so Claude Code can push branches and open PRs directly.
