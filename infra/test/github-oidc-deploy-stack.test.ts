import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { GithubOidcDeployStack } from '../lib/github-oidc-deploy-stack';

function synth() {
  const app = new App();
  const stack = new GithubOidcDeployStack(app, 'TestStack');
  return Template.fromStack(stack);
}

describe('GithubOidcDeployStack', () => {
  it('creates the GitHub OIDC provider', () => {
    const t = synth();
    // CDK synthesizes a Custom Resource for OpenIdConnectProvider; the native
    // AWS::IAM::OIDCProvider CFN type is not yet used by the L2 construct.
    t.hasResourceProperties('Custom::AWSCDKOpenIdConnectProvider', {
      Url: 'https://token.actions.githubusercontent.com',
      ClientIDList: ['sts.amazonaws.com'],
    });
  });

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

  it('grants deploy role sts:AssumeRole on cdk-* roles', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRole',
            Resource: { 'Fn::Join': ['', Match.arrayWith([':role/cdk-*'])] },
          }),
        ]),
      },
      Roles: Match.arrayWith([{ Ref: Match.stringLikeRegexp('^DeployRole') }]),
    });
  });

  it('grants deploy role S3 read/write on site-bucket pattern', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['s3:GetObject', 's3:PutObject', 's3:DeleteObject']),
            Resource: Match.arrayWith([
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
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'cloudfront:CreateInvalidation',
            Resource: '*',
          }),
        ]),
      },
    });
  });
});
