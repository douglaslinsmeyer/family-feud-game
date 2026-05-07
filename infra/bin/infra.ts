#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { FamilyFeudStack } from '../lib/family-feud-stack';

const app = new cdk.App();
new FamilyFeudStack(app, 'FamilyFeudStack');
