#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { FamilyFeudStack } from '../lib/family-feud-stack';
import { GithubOidcDeployStack } from '../lib/github-oidc-deploy-stack';

const app = new cdk.App();
new FamilyFeudStack(app, 'FamilyFeudStack');
new GithubOidcDeployStack(app, 'GithubOidcDeployStack');
