import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';

import {
  asError,
  beginRetry,
  initialRecovery,
  recoverOnRouteChange,
  repeatedAfterRetry,
  type RecoveryState,
} from './error-recovery.ts';
import { ErrorScreen } from './error-screen.tsx';

export type CrashReporter = (error: Error, info: ErrorInfo) => void | Promise<void>;

type RouteErrorBoundaryProps = {
  children: ReactNode;
  recoveryKey: string;
  onGoToStart: () => void;
  onError?: CrashReporter;
};

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RecoveryState> {
  state = initialRecovery(this.props.recoveryKey);

  static getDerivedStateFromError(thrown: unknown): Partial<RecoveryState> {
    return { error: asError(thrown), caughtAt: Date.now() };
  }

  static getDerivedStateFromProps(
    props: RouteErrorBoundaryProps,
    state: RecoveryState,
  ): Partial<RecoveryState> | null {
    return recoverOnRouteChange(props.recoveryKey, state);
  }

  componentDidCatch(thrown: Error, info: ErrorInfo) {
    try {
      // #8 can supply its crash reporter here without changing route recovery.
      void Promise.resolve(this.props.onError?.(asError(thrown), info)).catch(() => {});
    } catch {
      // Reporting failures must not replace the recovery screen.
    }
  }

  retry = () => {
    this.setState((state) => beginRetry(state, Date.now()));
  };

  render() {
    const { error, attempt, caughtAt, revision } = this.state;
    if (error) {
      return (
        <ErrorScreen
          showGoToStart={repeatedAfterRetry(error, attempt, caughtAt)}
          onRetry={this.retry}
          onGoToStart={this.props.onGoToStart}
        />
      );
    }
    return <Fragment key={revision}>{this.props.children}</Fragment>;
  }
}
