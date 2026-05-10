# CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace local `scripts/deploy.sh` with a GitHub Actions pipeline that auto-deploys the SPA + CDK infra on push to `main`, authenticated via GitHub OIDC, gated by lint/typecheck/tests/cdk-synth.

**Architecture:** Two CDK stacks (`FamilyFeudStack` existing app stack, `GithubOidcDeployStack` new bootstrap stack with the OIDC provider + two IAM roles); two GitHub Actions workflows (`ci.yml` for PR checks + `cdk diff` comment, `deploy.yml` for push-to-main → cdk deploy → SPA build → S3 sync → CloudFront invalidation). PR workflows assume a read-only role; deploy workflow assumes a main-branch-pinned deploy role — trust separation enforced in the OIDC trust policy.

**Tech Stack:** AWS CDK v2 + TypeScript, GitHub Actions, GitHub OIDC, `aws-actions/configure-aws-credentials@v4`, `marocchino/sticky-pull-request-comment@v2`, `js-yaml` (test-only).

**Spec:** `docs/superpowers/specs/2026-05-09-cicd-pipeline-design.md`

---

## File Structure

**Created:**
- `infra/lib/github-oidc-deploy-stack.ts` — OIDC provider + `family-feud-deploy` + `family-feud-ci-readonly` roles
- `infra/test/github-oidc-deploy-stack.test.ts` — Jest tests asserting the synthesized CloudFormation matches the design
- `.github/workflows/deploy.yml` — push-to-main deploy workflow
- `.github/workflows/ci.yml` — PR validation workflow
- `tests/workflows/workflow-trust-model.test.ts` — vitest tests guarding the trust model invariants in workflow YAML

**Modified:**
- `infra/bin/infra.ts` — instantiate `GithubOidcDeployStack`
- `package.json` (root) — add `js-yaml` + `@types/js-yaml` to devDependencies

**Each task: Test → run-fail → implement → run-pass → commit.**

---

## Task 1: TDD the OIDC provider

**Files:**
- Create: `infra/test/github-oidc-deploy-stack.test.ts`
- Create: `infra/lib/github-oidc-deploy-stack.ts`

- [ ] **Step 1: Write the failing test**

Create `infra/test/github-oidc-deploy-stack.test.ts`:

```ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { GithubOidcDeployStack } from '../lib/github-oidc-deploy-stack';

function synth() {
  const app = new App();
  const stack = new GithubOidcDeployStack(app, 'TestStack');
  return Template.fromStack(stack);
}

describe('GithubOidcDeployStack', () => {
  it('creates the GitHub OIDC provider', () => {
    const t = synth();
    t.hasResourceProperties('Custom::AWSCDKOpenIdConnectProvider', {
      Url: 'https://token.actions.githubusercontent.com',
      ClientIDList: ['sts.amazonaws.com'],
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd infra && npx jest github-oidc-deploy-stack
```

Expected: FAIL — `Cannot find module '../lib/github-oidc-deploy-stack'`.

- [ ] **Step 3: Implement the minimum to pass**

Create `infra/lib/github-oidc-deploy-stack.ts`:

```ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class GithubOidcDeployStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new iam.OpenIdConnectProvider(this, 'GithubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });
  }
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
cd infra && npx jest github-oidc-deploy-stack
```

Expected: PASS — 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add infra/lib/github-oidc-deploy-stack.ts infra/test/github-oidc-deploy-stack.test.ts
git commit -m "feat(infra): scaffold GithubOidcDeployStack with OIDC provider"
```

---

## Task 2: TDD the deploy role with main-branch trust

**Files:**
- Modify: `infra/test/github-oidc-deploy-stack.test.ts`
- Modify: `infra/lib/github-oidc-deploy-stack.ts`

- [ ] **Step 1: Add a failing test for the deploy role**

Append to `infra/test/github-oidc-deploy-stack.test.ts` inside the `describe` block:

```ts
  it('creates family-feud-deploy role pinned to refs/heads/main', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'family-feud-deploy',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRoleWithWebIdentity',
            Effect: 'Allow',
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
              },
              StringLike: {
                'token.actions.githubusercontent.com:sub':
                  'repo:douglaslinsmeyer/family-feud-game:ref:refs/heads/main',
              },
            },
          },
        ],
      },
    });
  });
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd infra && npx jest github-oidc-deploy-stack
```

Expected: FAIL — second test fails: "no resource matched 'AWS::IAM::Role' with RoleName 'family-feud-deploy'".

- [ ] **Step 3: Add the deploy role to the stack**

Modify `infra/lib/github-oidc-deploy-stack.ts` to:

```ts
import { Stack, StackProps } from 'aws-cdk-lib';
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

    new iam.Role(this, 'DeployRole', {
      roleName: 'family-feud-deploy',
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': `repo:${REPO}:ref:refs/heads/main` },
      }),
    });
  }
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
cd infra && npx jest github-oidc-deploy-stack
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add infra/lib/github-oidc-deploy-stack.ts infra/test/github-oidc-deploy-stack.test.ts
git commit -m "feat(infra): add main-branch-pinned family-feud-deploy role"
```

---

## Task 3: TDD the deploy role's permissions

**Files:**
- Modify: `infra/test/github-oidc-deploy-stack.test.ts`
- Modify: `infra/lib/github-oidc-deploy-stack.ts`

- [ ] **Step 1: Add failing tests for the three policy statements**

Append inside the `describe` block:

```ts
  it('grants deploy role sts:AssumeRole on cdk-* roles', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: expect.arrayContaining([
          expect.objectContaining({
            Action: 'sts:AssumeRole',
            Resource: { 'Fn::Join': ['', expect.arrayContaining([':role/cdk-*'])] },
          }),
        ]),
      },
      Roles: expect.arrayContaining([{ Ref: expect.stringMatching(/^DeployRole/) }]),
    });
  });

  it('grants deploy role S3 read/write on site-bucket pattern', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: expect.arrayContaining([
          expect.objectContaining({
            Action: expect.arrayContaining(['s3:GetObject', 's3:PutObject', 's3:DeleteObject']),
            Resource: expect.arrayContaining([
              'arn:aws:s3:::*familyfeudstack*',
              'arn:aws:s3:::*familyfeudstack*/*',
            ]),
          }),
        ]),
      },
    });
  });

  it('grants deploy role cloudfront:CreateInvalidation', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: expect.arrayContaining([
          expect.objectContaining({
            Action: 'cloudfront:CreateInvalidation',
            Resource: '*',
          }),
        ]),
      },
    });
  });
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd infra && npx jest github-oidc-deploy-stack
```

Expected: FAIL — three new failures, all "no AWS::IAM::Policy matched the assertion".

- [ ] **Step 3: Add the three policy statements**

Inside `GithubOidcDeployStack`'s constructor, after the `DeployRole` is created and before its closing `}`, capture it in a `const` and add policies. Replace the `new iam.Role(this, 'DeployRole', { ... });` line with:

```ts
    const deployRole = new iam.Role(this, 'DeployRole', {
      roleName: 'family-feud-deploy',
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': `repo:${REPO}:ref:refs/heads/main` },
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
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
cd infra && npx jest github-oidc-deploy-stack
```

Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add infra/lib/github-oidc-deploy-stack.ts infra/test/github-oidc-deploy-stack.test.ts
git commit -m "feat(infra): grant deploy role least-privilege S3+CloudFront+AssumeRole"
```

---

## Task 4: TDD the CI readonly role

**Files:**
- Modify: `infra/test/github-oidc-deploy-stack.test.ts`
- Modify: `infra/lib/github-oidc-deploy-stack.ts`

- [ ] **Step 1: Add failing tests for the readonly role + its policy**

Append inside the `describe` block:

```ts
  it('creates family-feud-ci-readonly role trusting any branch in the repo', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'family-feud-ci-readonly',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRoleWithWebIdentity',
            Effect: 'Allow',
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
              },
              StringLike: {
                'token.actions.githubusercontent.com:sub':
                  'repo:douglaslinsmeyer/family-feud-game:*',
              },
            },
          },
        ],
      },
    });
  });

  it('grants CI role only sts:AssumeRole on cdk-*-lookup-role-*', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          expect.objectContaining({
            Action: 'sts:AssumeRole',
            Resource: { 'Fn::Join': ['', expect.arrayContaining([':role/cdk-*-lookup-role-*'])] },
          }),
        ],
      },
      Roles: expect.arrayContaining([{ Ref: expect.stringMatching(/^CiReadonlyRole/) }]),
    });
  });
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd infra && npx jest github-oidc-deploy-stack
```

Expected: FAIL — two new failures.

- [ ] **Step 3: Add the readonly role**

Inside `GithubOidcDeployStack` constructor, after the deploy role's policies and before the closing `}`, add:

```ts
    const ciRole = new iam.Role(this, 'CiReadonlyRole', {
      roleName: 'family-feud-ci-readonly',
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': `repo:${REPO}:*` },
      }),
    });
    ciRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${this.account}:role/cdk-*-lookup-role-*`],
    }));
```

Then add `CfnOutput` import and outputs at the end of the constructor:

```ts
    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
    new CfnOutput(this, 'CiRoleArn', { value: ciRole.roleArn });
```

Update the import line at the top of the file to include `CfnOutput`:

```ts
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
```

- [ ] **Step 4: Run all tests in the file and verify they pass**

```bash
cd infra && npx jest github-oidc-deploy-stack
```

Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add infra/lib/github-oidc-deploy-stack.ts infra/test/github-oidc-deploy-stack.test.ts
git commit -m "feat(infra): add CI readonly role + role-arn outputs"
```

---

## Task 5: Wire the new stack into the CDK app entrypoint

**Files:**
- Modify: `infra/bin/infra.ts`

- [ ] **Step 1: Update the entrypoint**

Replace `infra/bin/infra.ts` with:

```ts
#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { FamilyFeudStack } from '../lib/family-feud-stack';
import { GithubOidcDeployStack } from '../lib/github-oidc-deploy-stack';

const app = new cdk.App();
new FamilyFeudStack(app, 'FamilyFeudStack');
new GithubOidcDeployStack(app, 'GithubOidcDeployStack');
```

- [ ] **Step 2: Run `cdk synth` and verify both stacks are listed**

```bash
cd infra && npx cdk list
```

Expected output (order may vary):

```
FamilyFeudStack
GithubOidcDeployStack
```

- [ ] **Step 3: Run a full synth to confirm no errors**

```bash
cd infra && npx cdk synth GithubOidcDeployStack > /dev/null
```

Expected: exit code 0 (no template printed because of the redirect, but no errors either).

- [ ] **Step 4: Commit**

```bash
git add infra/bin/infra.ts
git commit -m "feat(infra): instantiate GithubOidcDeployStack in app entrypoint"
```

---

## Task 6: CHECKPOINT — Bootstrap and deploy the OIDC stack (manual, one-time, requires AWS auth)

**This is a manual task. Do not proceed past this checkpoint without confirming the AWS-side roles exist.**

- [ ] **Step 1: Confirm AWS CLI is authenticated to the target account**

```bash
aws sts get-caller-identity
```

Expected: `Account: 951395862865`. If not, the user must `aws login` (or equivalent) first.

- [ ] **Step 2: Bootstrap CDK in the target region (if not already done)**

```bash
cd infra && npx cdk bootstrap aws://951395862865/us-east-2
```

Expected: `✅ Environment aws://951395862865/us-east-2 bootstrapped.` If the bootstrap stack already exists, output will say so — that's fine.

- [ ] **Step 3: Deploy only the OIDC stack**

```bash
cd infra && npx cdk deploy GithubOidcDeployStack --require-approval never
```

Expected: stack creates successfully. The output includes:

```
GithubOidcDeployStack.DeployRoleArn = arn:aws:iam::951395862865:role/family-feud-deploy
GithubOidcDeployStack.CiRoleArn = arn:aws:iam::951395862865:role/family-feud-ci-readonly
```

- [ ] **Step 4: Verify both roles exist**

```bash
aws iam get-role --role-name family-feud-deploy --query 'Role.Arn' --output text
aws iam get-role --role-name family-feud-ci-readonly --query 'Role.Arn' --output text
```

Expected: both commands print the role ARNs without error.

- [ ] **Step 5: Confirm with the user before proceeding**

Report the two ARNs to the user and confirm they match the spec before continuing.

---

## Task 7: Add `js-yaml` dev dependency and write workflow trust-model tests

**Files:**
- Modify: `package.json` (root)
- Create: `tests/workflows/workflow-trust-model.test.ts`

- [ ] **Step 1: Install js-yaml and its types**

```bash
npm install --save-dev js-yaml @types/js-yaml
```

Expected: both packages added to `devDependencies` in `package.json`.

- [ ] **Step 2: Write the failing trust-model tests**

Create `tests/workflows/workflow-trust-model.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

function loadWorkflow(name: string): any {
  const p = resolve(__dirname, '../../.github/workflows', name);
  return yaml.load(readFileSync(p, 'utf8'));
}

function stepUses(steps: any[], substr: string): any | undefined {
  return steps.find((s) => typeof s.uses === 'string' && s.uses.includes(substr));
}

describe('workflow trust model', () => {
  describe('deploy.yml', () => {
    const wf = loadWorkflow('deploy.yml');
    const job = wf.jobs.deploy;
    const steps = job.steps as any[];
    const auth = stepUses(steps, 'aws-actions/configure-aws-credentials');

    it('triggers only on push to main and workflow_dispatch', () => {
      expect(wf.on.push.branches).toEqual(['main']);
      expect('workflow_dispatch' in wf.on).toBe(true);
    });

    it('uses concurrency group deploy-prod with cancel-in-progress: false', () => {
      expect(wf.concurrency.group).toBe('deploy-prod');
      expect(wf.concurrency['cancel-in-progress']).toBe(false);
    });

    it('grants id-token: write at the workflow level', () => {
      expect(wf.permissions['id-token']).toBe('write');
    });

    it('assumes the deploy role (not the readonly role)', () => {
      expect(auth).toBeDefined();
      expect(auth.with['role-to-assume']).toContain('family-feud-deploy');
      expect(auth.with['role-to-assume']).not.toContain('readonly');
    });

    it('runs all gates (lint, tsc, vitest, cdk synth) BEFORE configuring AWS credentials', () => {
      const authIdx = steps.indexOf(auth);
      const before = steps.slice(0, authIdx).map((s) => (s.run || '').replace(/\s+/g, ' '));
      expect(before.some((r) => r.includes('npm run lint'))).toBe(true);
      expect(before.some((r) => r.includes('tsc -b'))).toBe(true);
      expect(before.some((r) => r.includes('npm run test:run'))).toBe(true);
      expect(before.some((r) => r.includes('cdk synth'))).toBe(true);
    });
  });

  describe('ci.yml', () => {
    const wf = loadWorkflow('ci.yml');
    const job = wf.jobs.checks;
    const steps = job.steps as any[];
    const auth = stepUses(steps, 'aws-actions/configure-aws-credentials');

    it('triggers only on pull_request to main', () => {
      expect(wf.on.pull_request.branches).toEqual(['main']);
      expect('push' in wf.on).toBe(false);
    });

    it('cancels stale runs (cancel-in-progress: true)', () => {
      expect(wf.concurrency['cancel-in-progress']).toBe(true);
    });

    it('assumes the readonly role (NEVER the deploy role)', () => {
      expect(auth).toBeDefined();
      expect(auth.with['role-to-assume']).toContain('family-feud-ci-readonly');
      expect(auth.with['role-to-assume']).not.toContain('family-feud-deploy');
    });

    it('posts a sticky cdk diff PR comment', () => {
      const sticky = stepUses(steps, 'marocchino/sticky-pull-request-comment');
      expect(sticky).toBeDefined();
      expect(sticky.with.header).toBe('cdk-diff');
    });
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

```bash
npm run test:run -- tests/workflows
```

Expected: FAIL — `ENOENT: no such file or directory, open '.../.github/workflows/deploy.yml'`.

- [ ] **Step 4: Commit the tests**

```bash
git add package.json package-lock.json tests/workflows/workflow-trust-model.test.ts
git commit -m "test(workflows): assert trust-model invariants for deploy/ci YAML"
```

---

## Task 8: Implement `deploy.yml`

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow file**

```bash
mkdir -p .github/workflows
```

Then create `.github/workflows/deploy.yml`:

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
        with:
          node-version: '25'
          cache: 'npm'
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
        run: npx cdk deploy FamilyFeudStack --require-approval never --outputs-file cdk-outputs.json
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

Note: `cdk deploy` is scoped to `FamilyFeudStack` only — never the OIDC stack from CI.

- [ ] **Step 2: Run the trust-model tests; deploy.yml ones should pass, ci.yml ones still fail**

```bash
npm run test:run -- tests/workflows
```

Expected: 5 deploy.yml tests PASS, 4 ci.yml tests still FAIL (file not found).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): deploy workflow — push-to-main runs gates → cdk deploy → SPA upload"
```

---

## Task 9: Implement `ci.yml`

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/ci.yml`:

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
        with:
          node-version: '25'
          cache: 'npm'
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
          npx cdk diff FamilyFeudStack 2>&1 | tee /tmp/cdk-diff.txt
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

- [ ] **Step 2: Run all trust-model tests; all should pass**

```bash
npm run test:run -- tests/workflows
```

Expected: 9 tests PASS.

- [ ] **Step 3: Run the full root test suite to confirm no regressions**

```bash
npm run test:run
```

Expected: all tests pass (146 existing + 9 new = 155).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): PR validation workflow with cdk diff sticky comment"
```

---

## Task 10: CHECKPOINT — Configure GitHub repo settings (manual, one-time)

**Manual task. Requires repo admin access.**

- [ ] **Step 1: Configure branch protection on `main` via `gh api`**

```bash
gh api -X PUT \
  repos/douglaslinsmeyer/family-feud-game/branches/main/protection \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]='checks' \
  -f enforce_admins=false \
  -f required_pull_request_reviews[dismiss_stale_reviews]=true \
  -f required_pull_request_reviews[required_approving_review_count]=0 \
  -f restrictions=
```

Expected: 200 response with the new protection settings echoed back. (`required_approving_review_count=0` is intentional — single-maintainer repo; the gate is the CI check, not human review.)

- [ ] **Step 2: Disable "Allow Actions to create and approve PRs"**

```bash
gh api -X PUT repos/douglaslinsmeyer/family-feud-game/actions/permissions/workflow \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false
```

Expected: 204 No Content.

- [ ] **Step 3: Set fork-PR approval to "first-time contributors"**

This setting cannot be changed via the public API in all cases. Open `https://github.com/douglaslinsmeyer/family-feud-game/settings/actions` in a browser and under "Fork pull request workflows from outside collaborators" choose **"Require approval for first-time contributors"**.

- [ ] **Step 4: Verify branch protection is in effect**

```bash
gh api repos/douglaslinsmeyer/family-feud-game/branches/main/protection \
  --jq '{checks: .required_status_checks.contexts, strict: .required_status_checks.strict, prs_required: .required_pull_request_reviews != null}'
```

Expected output:

```json
{"checks":["checks"],"strict":true,"prs_required":true}
```

---

## Task 11: CHECKPOINT — Run the 6-step verification plan

**Acceptance criteria from the spec. Do not claim the pipeline is done until all six pass.**

- [ ] **Step 1 (verification step 2 from spec): No-op PR runs ci.yml green and posts cdk diff comment**

```bash
git checkout -b verify/cicd-noop
# Make a trivial change — add a trailing newline to README.md
printf '\n' >> README.md
git add README.md
git commit -m "test(cicd): no-op PR to verify ci pipeline"
git push -u origin verify/cicd-noop
gh pr create --fill --base main
```

Wait for the PR's `ci / checks` run to complete. Expected:
- Green check on the PR.
- A sticky comment from `github-actions[bot]` titled "cdk diff vs deployed prod stack" showing **"There were no differences"** or equivalent.

If green and the comment appears: continue. Otherwise, fix and re-push.

- [ ] **Step 2 (verification step 3 from spec): A failing-gate PR is blocked**

On the same branch:

```bash
# Introduce a typo in the existing sanity test — break it deliberately
# tests/sanity.test.ts: change `expect(2 + 2).toBe(4)` to `expect(2 + 2).toBe(5)`
git commit -am "test(cicd): intentional failing test to verify gate"
git push
```

Expected: the new push triggers ci.yml; the test step fails; the PR's "Merge" button is disabled with "Required statuses must pass".

Then revert just that broken commit:

```bash
git revert --no-edit HEAD
git push
```

Expected: ci.yml reruns and goes green.

- [ ] **Step 3 (verification step 4 from spec): Merge no-op to main runs deploy.yml end-to-end**

```bash
gh pr merge --squash --delete-branch
```

Watch the deploy run in the Actions tab. Expected:
- All gates pass.
- `cdk deploy FamilyFeudStack` reports "no changes" (or only outputs).
- `aws s3 sync` uploads the rebuilt assets.
- `aws cloudfront create-invalidation` returns an invalidation ID.
- The CloudFront URL still serves the app.

- [ ] **Step 4 (verification step 5 from spec): A visible change deploys to prod**

```bash
git checkout main && git pull
git checkout -b verify/cicd-visible
# Add a non-breaking visible marker — e.g., add a data-cicd-verified attribute to the body
# Edit src/main.tsx (or equivalent root file) to add a console.log("[CICD verified 2026-05-09]")
git commit -am "feat(cicd): add cicd-verified marker"
git push -u origin verify/cicd-visible
gh pr create --fill --base main
gh pr merge --squash --delete-branch  # after CI is green
```

After the deploy completes, open the live CloudFront URL in a browser and check the JS console for `[CICD verified 2026-05-09]`. Expected: marker present.

- [ ] **Step 5 (verification step 6 from spec): Revert removes the change from prod**

```bash
git checkout main && git pull
git revert <sha-of-the-marker-commit> --no-edit
git push
```

Watch deploy.yml run on main; after it completes, refresh the live URL and confirm the marker is gone from the console.

- [ ] **Step 6: Final cleanup**

If `scripts/deploy.sh` is no longer needed (CI now owns prod deploys), open a follow-up PR to remove it — or keep it as an emergency-bypass script with a comment at the top stating that. **Recommend: keep it, add a header comment that says "Emergency / disaster-recovery only — CI owns routine deploys."**

```bash
git checkout main && git pull
# Edit scripts/deploy.sh, add at the top below the shebang:
#   # EMERGENCY ONLY — CI/CD pipeline (.github/workflows/deploy.yml) owns
#   # routine production deploys. Use this script only if GitHub Actions is
#   # unavailable. Requires AWS CLI authenticated as a principal allowed to
#   # assume the family-feud-deploy role (or root, last resort).
git commit -am "docs(scripts): mark deploy.sh as emergency-only"
git push
```

(That last commit goes through the same CI/CD gates — which is itself another dogfood verification.)

**Pipeline is complete when all 6 steps above pass.** Update the project status memory after this is done.

---

## Self-Review

(Run after writing the plan; fix issues inline.)

**Spec coverage:**
- ✅ Two CDK stacks (Tasks 1–5)
- ✅ OIDC provider + 2 roles (Tasks 1–4)
- ✅ deploy.yml (Task 8)
- ✅ ci.yml (Task 9)
- ✅ Bootstrap order documented (Task 6)
- ✅ Branch protection / repo settings (Task 10)
- ✅ Rollback procedure: deferred to ops; the spec is `git revert` + push, exercised in Task 11 step 5
- ✅ Verification plan: Task 11 mirrors all six spec steps (numbering shifted by one because spec step 1 is the bootstrap, executed in Task 6)
- ✅ "Out of scope" items intentionally absent

**Placeholder scan:** No TBDs, every code block contains the actual content, every command has expected output.

**Type consistency:** Role names are `family-feud-deploy` and `family-feud-ci-readonly` consistently across CDK code, tests, and workflow YAML. Stack names are `FamilyFeudStack` and `GithubOidcDeployStack` consistently. Output keys (`SiteBucketName`, `DistributionId`, `TableName`, `IdentityPoolId`) match the existing `family-feud-stack.ts`.
