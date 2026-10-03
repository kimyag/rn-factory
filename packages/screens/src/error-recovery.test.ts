import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  asError,
  beginRetry,
  initialRecovery,
  recoverOnRouteChange,
  repeatedAfterRetry,
  retryAttempt,
} from './error-recovery.ts';

function screenError(message = 'Cannot load', origin = 'Screen') {
  const error = new Error(message);
  error.stack = `Error: ${message}\n    at ${origin} (screen.tsx:10:3)`;
  return error;
}

test('a retry remounts scenes and reveals the escape action for the same immediate failure', () => {
  const error = screenError();
  const caught = { ...initialRecovery('settings-1'), error, caughtAt: 100 };
  assert.equal(repeatedAfterRetry(error, caught.attempt, caught.caughtAt), false);
  const retried = { ...caught, ...beginRetry(caught, 200) };
  assert.equal(retried.error, null);
  assert.equal(retried.revision, caught.revision + 1);
  assert.equal(retried.recoveryKey, 'settings-1');
  assert.equal(repeatedAfterRetry(screenError(), retried.attempt, 201), true);
  assert.equal(repeatedAfterRetry(screenError(), retried.attempt, 10_200), true);
  assert.equal(repeatedAfterRetry(screenError(), retried.attempt, 10_201), false);
});

test('another failure or another origin is not the same retry failure', () => {
  const attempt = retryAttempt(screenError(), 100);
  assert.equal(repeatedAfterRetry(screenError('Different problem'), attempt, 101), false);
  assert.equal(repeatedAfterRetry(screenError('Cannot load', 'AnotherScreen'), attempt, 101), false);
  assert.equal(repeatedAfterRetry(screenError(), attempt, 99), false);
});

test('Go to start retains the fallback until the reset route key is committed', () => {
  const error = screenError();
  const failed = {
    ...initialRecovery('settings-1'),
    error,
    attempt: retryAttempt(error, 100),
    caughtAt: 101,
  };
  assert.equal(recoverOnRouteChange('settings-1', failed), null);
  assert.equal(failed.error, error);
  const recovered = { ...failed, ...recoverOnRouteChange('feature-new-key', failed) };
  assert.equal(recovered.error, null);
  assert.equal(recovered.attempt, null);
  assert.equal(recovered.revision, failed.revision + 1);
  assert.equal(repeatedAfterRetry(error, recovered.attempt, 102), false);
});

test('non-Error throws are normalized without exposing them as user-facing text', () => {
  const original = screenError();
  assert.equal(asError(original), original);
  assert.equal(asError('render failed').message, 'render failed');
});

test('ordinary navigation does not remount healthy scenes', () => {
  const healthy = initialRecovery('feature-1');
  const navigated = { ...healthy, ...recoverOnRouteChange('settings-2', healthy) };
  assert.equal(navigated.recoveryKey, 'settings-2');
  assert.equal(navigated.revision, healthy.revision);
});
