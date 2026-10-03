const immediateRetryWindow = 10_000;

export type RetryAttempt = {
  fingerprint: string;
  startedAt: number;
};

export type RecoveryState = {
  error: Error | null;
  caughtAt: number;
  attempt: RetryAttempt | null;
  revision: number;
  recoveryKey: string;
};

export function initialRecovery(recoveryKey: string): RecoveryState {
  return { error: null, caughtAt: 0, attempt: null, revision: 0, recoveryKey };
}

export function recoverOnRouteChange(
  recoveryKey: string,
  state: RecoveryState,
): Partial<RecoveryState> | null {
  if (recoveryKey === state.recoveryKey) {
    return null;
  }
  if (state.error === null) {
    return { recoveryKey };
  }
  return { ...initialRecovery(recoveryKey), revision: state.revision + 1 };
}

export function beginRetry(
  state: RecoveryState,
  now: number,
): Pick<RecoveryState, 'error' | 'attempt' | 'revision'> {
  return {
    error: null,
    attempt: state.error ? retryAttempt(state.error, now) : null,
    revision: state.revision + 1,
  };
}

export function asError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(String(thrown));
}

function fingerprint(error: Error): string {
  const origin = error.stack?.split('\n').find((line) => line.trim().startsWith('at ')) ?? '';
  return JSON.stringify([error.name, error.message, origin]);
}

export function retryAttempt(error: Error, now: number): RetryAttempt {
  return { fingerprint: fingerprint(error), startedAt: now };
}

export function repeatedAfterRetry(error: Error, attempt: RetryAttempt | null, now: number): boolean {
  if (!attempt) {
    return false;
  }
  const elapsed = now - attempt.startedAt;
  return elapsed >= 0 && elapsed <= immediateRetryWindow && fingerprint(error) === attempt.fingerprint;
}
