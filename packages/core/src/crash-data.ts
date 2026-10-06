import type { ErrorEvent } from '@sentry/react-native';

export function sanitizeCrashEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  delete event.extra;
  delete event.message;
  delete event.server_name;
  delete event.tags;
  delete event.fingerprint;
  delete event.transaction;
  event.contexts = {
    app: {
      app_identifier: event.contexts?.app?.app_identifier,
      app_version: event.contexts?.app?.app_version,
      app_build: event.contexts?.app?.app_build,
    },
    os: { name: event.contexts?.os?.name, version: event.contexts?.os?.version },
  };
  for (const exception of event.exception?.values ?? []) {
    exception.value = exception.type ?? 'Error';
    if (exception.mechanism) delete exception.mechanism.data;
    for (const frame of exception.stacktrace?.frames ?? []) {
      delete frame.vars;
      delete frame.pre_context;
      delete frame.post_context;
      delete frame.context_line;
      if (frame.filename) frame.filename = frame.filename.split(/[?#]/)[0];
      if (frame.abs_path) frame.abs_path = frame.abs_path.split(/[?#]/)[0];
    }
  }
  return event;
}
