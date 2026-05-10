import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

const REPO = 'douglaslinsmeyer/family-feud-game';

export class GithubOidcDeployStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Import the existing account-wide GitHub OIDC provider rather than creating
    // a new one — IAM allows only a single provider per issuer URL per account.
    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GithubOidc',
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
    );

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

    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
    new CfnOutput(this, 'CiRoleArn', { value: ciRole.roleArn });
  }
}
