import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
