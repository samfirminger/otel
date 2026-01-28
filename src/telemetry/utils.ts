import { getStringFromEnv } from '@opentelemetry/core';

export function getEnvironment(): 'test' | 'development' | 'production' {
  switch (getStringFromEnv('NODE_ENV')) {
    case 'test':
      return 'test';
    case 'production':
      return 'production';
    default:
      // some apps use 'local', we should be more consistent with 'development'
      return 'development';
  }
}

export function getLogLevel(): string {
  return getStringFromEnv('LOG_LEVEL') || 'info';
}

export function getOtelLogLevel(): string {
  return getStringFromEnv('OTEL_LOG_LEVEL') || 'info';
}

export function getServiceName(fallback: string = 'otel-spike'): string {
  return getStringFromEnv('K_SERVICE') || getStringFromEnv('APP_NAME') || fallback;
}

export function getServiceVersion(environment = getEnvironment()): string {
  const version = getStringFromEnv('K_REVISION') || getStringFromEnv('APP_VERSION') || 'unknown';

  if (environment === 'production') {
    return version;
  }

  return `${version}-${environment}`;
}
