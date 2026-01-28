// Re-export OpenTelemetry testing utilities
// These are used in tests to simulate the production OpenTelemetry setup
export { W3CTraceContextPropagator, W3CBaggagePropagator, CompositePropagator } from '@opentelemetry/core';
export { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
export { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';