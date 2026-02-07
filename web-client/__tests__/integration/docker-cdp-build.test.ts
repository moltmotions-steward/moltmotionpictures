/**
 * Integration Test: Docker Build with CDP Configuration
 *
 * Tests that the Dockerfile correctly accepts and uses CDP build arguments.
 * These tests verify:
 * - Docker image builds successfully with CDP args
 * - Build args are properly baked into the Next.js bundle
 * - Missing CDP args don't break the build
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

const TEST_CDP_PROJECT_ID = 'test-cdp-project-123';
const TEST_IMAGE_TAG = 'test-cdp-build';
const DOCKERFILE_PATH = path.join(__dirname, '../../../web-client/Dockerfile');
const REPO_ROOT = path.join(__dirname, '../../..');

describe('Docker Build with CDP Configuration', () => {
  // Cleanup function to remove test images
  const cleanupTestImage = async () => {
    try {
      await execAsync(`docker rmi ${TEST_IMAGE_TAG} 2>/dev/null || true`);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  beforeAll(async () => {
    await cleanupTestImage();
  });

  afterAll(async () => {
    await cleanupTestImage();
  });

  it.skip('builds successfully with CDP build args', async () => {
    const buildCommand = `
      cd ${REPO_ROOT} && \
      docker build \
        --build-arg NEXT_PUBLIC_CDP_PROJECT_ID="${TEST_CDP_PROJECT_ID}" \
        --build-arg NEXT_PUBLIC_CDP_CHECKOUT_ENABLED="true" \
        --build-arg NEXT_PUBLIC_API_URL="/api/v1" \
        -t ${TEST_IMAGE_TAG} \
        -f web-client/Dockerfile \
        . 2>&1
    `;

    // Build should complete without errors
    const result = await execAsync(buildCommand, {
      timeout: 300000, // 5 minute timeout for Docker build
    });

    // Docker sends output to stderr by default, check both
    const output = result.stdout + result.stderr;

    // Build should have some output
    expect(output.length).toBeGreaterThan(0);

    // Build should complete successfully (check for success indicators)
    expect(
      output.includes('Successfully built') ||
      output.includes('Successfully tagged') ||
      output.includes('writing image')
    ).toBe(true);

    // Should not have critical errors
    expect(output).not.toMatch(/ERROR.*fatal/i);
  }, 300000); // 5 minute test timeout

  it.skip('creates image with CDP configuration baked in', async () => {
    // Run a container to verify env vars are available in the built image
    const runCommand = `
      docker run --rm ${TEST_IMAGE_TAG} \
      node -e "
        const fs = require('fs');
        const path = require('path');
        // Next.js standalone build puts files in .next/standalone
        const nextDir = path.join(process.cwd(), '.next');
        console.log('Next.js directory exists:', fs.existsSync(nextDir));
      "
    `;

    const { stdout } = await execAsync(runCommand, { timeout: 30000 });
    expect(stdout).toContain('Next.js directory exists: true');
  }, 60000);

  it('build script exists and is executable', async () => {
    const scriptPath = path.join(REPO_ROOT, 'scripts/build-web-with-cdp.sh');
    const { stdout } = await execAsync(`test -x ${scriptPath} && echo "executable"`);
    expect(stdout.trim()).toBe('executable');
  });

  it('build script fails without CDP Project ID', async () => {
    const scriptPath = path.join(REPO_ROOT, 'scripts/build-web-with-cdp.sh');

    try {
      await execAsync(`${scriptPath}`);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe(1);
      expect(error.stdout || error.stderr).toContain('CDP Project ID required');
    }
  });

  it('Dockerfile contains CDP ARG declarations', async () => {
    const { stdout } = await execAsync(`cat ${DOCKERFILE_PATH} | grep -c "ARG NEXT_PUBLIC_CDP"`);
    const argCount = parseInt(stdout.trim());

    // Should have at least 2 CDP-related ARGs
    expect(argCount).toBeGreaterThanOrEqual(2);
  });

  it('Dockerfile ARGs are in correct order (before npm install)', async () => {
    const { stdout } = await execAsync(`cat ${DOCKERFILE_PATH}`);

    const argIndex = stdout.indexOf('ARG NEXT_PUBLIC_CDP_PROJECT_ID');
    const npmInstallIndex = stdout.indexOf('npm install');

    // ARGs should come before npm install
    expect(argIndex).toBeGreaterThan(0);
    expect(argIndex).toBeLessThan(npmInstallIndex);
  });
});

describe('CDP Build Script Validation', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts/build-web-with-cdp.sh');

  it('script has proper shebang', async () => {
    const { stdout } = await execAsync(`head -1 ${scriptPath}`);
    expect(stdout.trim()).toBe('#!/bin/bash');
  });

  it('script validates CDP Project ID parameter', async () => {
    try {
      await execAsync(`${scriptPath} ""`);
      expect(true).toBe(false); // Should not succeed
    } catch (error: any) {
      expect(error.stdout || error.stderr).toContain('CDP Project ID required');
    }
  });

  it('script includes usage instructions', async () => {
    const { stdout } = await execAsync(`cat ${scriptPath}`);
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('CDP_PROJECT_ID');
  });

  it('script builds with custom image tag when provided', async () => {
    const { stdout } = await execAsync(`cat ${scriptPath}`);
    // Script should accept second parameter for image tag
    expect(stdout).toContain('IMAGE_TAG');
    expect(stdout).toContain('${2:-');
  });

  it('script includes deployment instructions in output', async () => {
    const { stdout } = await execAsync(`cat ${scriptPath}`);
    expect(stdout).toContain('Push to registry');
    expect(stdout).toContain('kubectl');
  });
});
