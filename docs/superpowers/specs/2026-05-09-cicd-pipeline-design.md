# CI/CD Pipeline for Production — Design

**Date:** 2026-05-09
**Status:** Approved (pending spec review)
**Owner:** Douglas Linsmeyer

## Goal

Replace the local `scripts/deploy.sh` with a GitHub Actions–driven CI/CD pipeline that deploys the Family Feud SPA + CDK infrastructure to production on every push to `main`, gated by lint/typecheck/test/synth, authenticated via GitHub OIDC (no long-lived AWS credentials).

## Constraints & Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Environments | **Prod only** | Single-event app; one CDK stack today; staging adds infra cost without de-risking the event. |
| Trigger | **Auto on push to `main`** | Fast feedback. Branch protection forces changes through reviewed PRs. |
| Infra change handling | **Always run `cdk deploy`** | Idempotent; matches today's `deploy.sh`. Mitigated by `cdk diff` posted on PRs. |
| AWS auth | **GitHub OIDC → IAM role** | No secrets to rotate; short-lived credentials; trust policy restricts deploy role to `main` branch. |
| CI tool | **GitHub Actions** | Repo is on GitHub; AWS-native CodePipeline is overkill for one stack. |
| Rollback | **`git revert` + push** | Pipeline redeploys prior state. ~3–5 min recovery. |

## Architecture

```
.github/workflows/
├── ci.yml         # PR checks (lint/typecheck/test/synth + cdk diff PR comment)
└── deploy.yml     # push to main: checks → cdk deploy → SPA build → S3 sync → CF invalidation

infra/
├── bin/infra.ts                              # instantiates both stacks
└── lib/
    ├── family-feud-stack.ts                  # existing: S3 + CloudFront + DDB + Cognito
    └── github-oidc-deploy-stack.ts           # NEW: OIDC provider + 2 IAM roles
```

### Two CDK stacks, one app

- `FamilyFeudStack` — application stack; redeployed by CI on every push to `main`.
- `GithubOidcDeployStack` — bootstrap stack; OIDC provider + deploy/CI roles. Deployed once from a developer laptop and never touched by CI. Separation prevents a chicken-and-egg lockout if the app stack ever fails to deploy and we need to fix it manually.

### Two IAM roles, one purpose each

- `family-feud-deploy` — assumed only by workflow runs on `refs/heads/main`. Permissions: `sts:AssumeRole` on `cdk-*` bootstrap roles + `s3:*` on the site bucket + `cloudfront:CreateInvalidation`.
- `family-feud-ci-readonly` — assumed by any workflow run (PRs included). Permissions: `sts:AssumeRole` on the `cdk-*-lookup-role-*` only. Used by PR `cdk diff` to read deployed state. Cannot mutate anything.

OIDC trust separation means a malicious or buggy PR cannot assume the deploy role even if the workflow file is modified in the PR — AWS rejects the token because `sub` does not match `ref:refs/heads/main`.

## Workflow: `deploy.yml`

Triggers: `push` to `main`, plus `workflow_dispatch` for manual re-runs.

```yaml
name: deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-prod
  cancel-in-progress: false

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '25', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc -b
      - run: npm run test:run
      - working-directory: infra
        run: npm ci && npx cdk synth

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::951395862865:role/family-feud-deploy
          aws-region: us-east-2

      - working-directory: infra
        run: npx cdk deploy --require-approval never --outputs-file cdk-outputs.json
      - id: outputs
        run: |
          echo "bucket=$(jq -r .FamilyFeudStack.SiteBucketName infra/cdk-outputs.json)" >> $GITHUB_OUTPUT
          echo "dist=$(jq -r .FamilyFeudStack.DistributionId   infra/cdk-outputs.json)" >> $GITHUB_OUTPUT
          echo "table=$(jq -r .FamilyFeudStack.TableName        infra/cdk-outputs.json)" >> $GITHUB_OUTPUT
          echo "pool=$(jq -r .FamilyFeudStack.IdentityPoolId    infra/cdk-outputs.json)" >> $GITHUB_OUTPUT
      - env:
          VITE_PERSISTENCE: ddb
          VITE_AWS_REGION: us-east-2
          VITE_COGNITO_IDENTITY_POOL_ID: ${{ steps.outputs.outputs.pool }}
          VITE_DDB_TABLE_NAME: ${{ steps.outputs.outputs.table }}
        run: npm run build
      - run: aws s3 sync dist/ s3://${{ steps.outputs.outputs.bucket }}/ --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ steps.outputs.outputs.dist }} --paths '/*'
```

**Key properties:**
- Steps 1–5 (checkout through `cdk synth`) run before `configure-aws-credentials`. A failing test stops the run before any AWS-side change.
- `concurrency: deploy-prod` with `cancel-in-progress: false` means rapid pushes queue rather than overlap. S3 sync + CloudFront invalidation are not atomic; overlapping deploys could leave the bucket in a mixed state.
- `workflow_dispatch` lets you re-run the latest `main` from the Actions tab without forcing a no-op commit (useful day-of if a deploy was interrupted).
- Node 25 mirrors the local `nvm` version, ensuring CI runs match developer-laptop behavior. Bumped together with the local `nvm` install whenever updated.

## Workflow: `ci.yml`

Triggers: `pull_request` to `main`.

```yaml
name: ci
on:
  pull_request:
    branches: [main]

permissions:
  id-token: write
  contents: read
  pull-requests: write

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '25', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc -b
      - run: npm run test:run
      - working-directory: infra
        run: npm ci && npx cdk synth

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::951395862865:role/family-feud-ci-readonly
          aws-region: us-east-2

      - id: diff
        working-directory: infra
        run: |
          npx cdk diff 2>&1 | tee /tmp/cdk-diff.txt
          {
            echo 'body<<EOF'
            echo '### `cdk diff` vs deployed prod stack'
            echo ''
            echo '```'
            cat /tmp/cdk-diff.txt
            echo '```'
            echo 'EOF'
          } >> $GITHUB_OUTPUT

      - uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: cdk-diff
          message: ${{ steps.diff.outputs.body }}
```

**Key properties:**
- Same gates as `deploy.yml`, then a `cdk diff` posted as a sticky PR comment.
- `cancel-in-progress: true` cancels stale CI runs when a newer commit is pushed to a PR.
- Uses the read-only role; cannot mutate AWS state.

## CDK: `GithubOidcDeployStack`

New file `infra/lib/github-oidc-deploy-stack.ts`:

```ts
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

const REPO = 'douglaslinsmeyer/family-feud-game';

export class GithubOidcDeployStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const deployRole = new iam.Role(this, 'DeployRole', {
      roleName: 'family-feud-deploy',
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike:   { 'token.actions.githubusercontent.com:sub': `repo:${REPO}:ref:refs/heads/main` },
      }),
    });

    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
    }));
    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: ['arn:aws:s3:::*familyfeudstack*', 'arn:aws:s3:::*familyfeudstack*/*'],
    }));
    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['cloudfront:CreateInvalidation'],
      resources: ['*'],
    }));

    const ciRole = new iam.Role(this, 'CiReadonlyRole', {
      roleName: 'family-feud-ci-readonly',
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike:   { 'token.actions.githubusercontent.com:sub': `repo:${REPO}:*` },
      }),
    });
    ciRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${this.account}:role/cdk-*-lookup-role-*`],
    }));

    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
    new CfnOutput(this, 'CiRoleArn',     { value: ciRole.roleArn });
  }
}
```

`infra/bin/infra.ts` updated to instantiate both stacks:

```ts
import * as cdk from 'aws-cdk-lib/core';
import { FamilyFeudStack } from '../lib/family-feud-stack';
import { GithubOidcDeployStack } from '../lib/github-oidc-deploy-stack';

const app = new cdk.App();
new FamilyFeudStack(app, 'FamilyFeudStack');
new GithubOidcDeployStack(app, 'GithubOidcDeployStack');
```

## Repo settings

Configured once after the workflows merge (via GitHub UI or `gh api`):

**Branch protection on `main`:**
- Require a pull request before merging (no direct pushes).
- Require the `ci / checks` status check to pass before merge.
- Require the branch to be up-to-date before merge (so `cdk diff` reflects what will deploy).
- Restrict push to `main` to repo admins only.

**Repo Actions settings:**
- Workflow permissions: read-only default token (each workflow opts in via `permissions:` block).
- Allow GitHub Actions to create and approve pull requests: **off**.
- Fork PR approval: "Require approval for first-time contributors."

**No GitHub secrets created.** OIDC means the only auth surface is `permissions: id-token: write` plus the IAM role ARNs in workflow YAML.

## Bootstrap order (one-time, from developer laptop)

1. `cd infra && npx cdk bootstrap aws://951395862865/us-east-2` — creates the CDK `cdk-*` roles. Skip if already bootstrapped.
2. `npx cdk deploy GithubOidcDeployStack` — creates the OIDC provider + `family-feud-deploy` + `family-feud-ci-readonly` roles.
3. Confirm with `aws iam get-role --role-name family-feud-deploy`.
4. Merge the workflow files to `main`. From this point forward, CI owns `FamilyFeudStack` deploys; the root user is no longer needed for routine work.

## Rollback

```bash
git revert <bad-sha>
git push origin main
```

The `concurrency: deploy-prod` block ensures the revert deploy doesn't race the bad deploy. `aws s3 sync --delete` + CloudFront invalidation means there's no stale-asset window after rollback. Recovery time ≈ one CI run (~3–5 min).

If a deploy is mid-flight when a problem is discovered: push the revert immediately (it queues behind the in-flight run via `concurrency`). The "Cancel workflow" button in the Actions UI is a fallback but is racy — the pushed revert is safer.

## Verification (acceptance criteria for the implementation plan)

The pipeline is not "done" until all six pass:

1. `cdk bootstrap` + `cdk deploy GithubOidcDeployStack` succeed; both IAM roles visible via `aws iam get-role`.
2. A throwaway no-op PR (e.g., `README.md` whitespace) shows `ci.yml` green and a `cdk diff` sticky comment reporting **no changes**.
3. A PR that deliberately fails one gate (e.g., a typo in a test) blocks merge with the failing check.
4. Merging a no-op change to `main` runs `deploy.yml` end-to-end: `cdk deploy` reports no changes, S3 sync uploads, CloudFront invalidation completes, live URL still serves the app.
5. A small visible change (e.g., footer date string) appears in prod after the workflow finishes.
6. `git revert` of step 5 + push removes the change from prod via the same pipeline.

## Out of scope

- Manual `workflow_dispatch` rollback to arbitrary SHA — `git revert` covers it.
- Slack/Discord notifications — GitHub commit status + Actions tab is sufficient.
- "Freeze" flag for event day — temporarily restricting push permissions in branch protection is enough.
- Custom domain / ACM cert.
- Per-PR preview environments.
- Staging environment.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Buggy CDK change auto-applies to prod (no staging) | `cdk diff` PR comment forces visibility before merge; branch protection requires PR + approval. |
| Concurrent deploys leave bucket in mixed state | `concurrency: deploy-prod` serializes deploys. |
| Compromised PR tries to assume deploy role | OIDC trust policy on deploy role pinned to `ref:refs/heads/main`; PRs (any branch) get only the read-only role. |
| First-time-contributor fork PRs spend Actions minutes | "Require approval for first-time contributors" repo setting. |
| Day-of-event accidental push | Branch protection's "restrict push to admins" can be tightened temporarily; `workflow_dispatch` provides intentional re-run path. |
| S3 ARN pattern `*familyfeudstack*` is loose | Acceptable for now; can tighten via cross-stack reference if a same-account collision ever becomes plausible. |
