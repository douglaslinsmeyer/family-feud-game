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
