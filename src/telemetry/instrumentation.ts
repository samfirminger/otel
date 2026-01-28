import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { diag, DiagConsoleLogger } from '@opentelemetry/api';
import { diagLogLevelFromString } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating';
import { getEnvironment, getOtelLogLevel, getServiceName, getServiceVersion } from './utils';

diag.setLogger(new DiagConsoleLogger(), diagLogLevelFromString(getOtelLogLevel()));

const environment = getEnvironment();
diag.debug(`Environment: ${environment}`);
diag.info(`OTEL_EXPORTER_OTLP_ENDPOINT: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'NOT SET'}`);

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: getServiceName(),
  [ATTR_SERVICE_VERSION]: getServiceVersion(),
  [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
});

const instrumentations = getNodeAutoInstrumentations({
  '@opentelemetry/instrumentation-fs': { enabled: false },
  '@opentelemetry/instrumentation-runtime-node': { enabled: false },
});

const sdk = new NodeSDK({
  resource,
  instrumentations,
});

try {
  sdk.start();
  diag.info('OpenTelemetry instrumentation started');
} catch (error) {
  diag.error('Error starting OpenTelemetry SDK', error);
}

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    diag.debug(`Received ${signal}, shutting down OpenTelemetry SDK`);
    await sdk.shutdown();
    diag.debug(`OpenTelemetry SDK shut down successfully`);
  } catch (error) {
    diag.error('Error shutting down OpenTelemetry SDK', error);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('beforeExit', shutdown);
