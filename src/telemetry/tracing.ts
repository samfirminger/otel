import { trace, context, propagation, type Attributes } from '@opentelemetry/api';

export { context, propagation, trace } from '@opentelemetry/api';
export type { Context, TextMapPropagator, Span, Tracer, Baggage } from '@opentelemetry/api';

/**
 * Add attributes to the current active span.
 * This is a simple wrapper around OpenTelemetry's span.setAttributes().
 *
 * @example
 * addSpanAttributes({ 'http.method': 'GET', 'http.path': '/api/users' })
 * addSpanAttributes({ 'user.id': '123', 'user.name': 'John' })
 */
export function addSpanAttributes(attributes: Attributes): void {
  const span = trace.getActiveSpan();
  if (!span) {
    return;
  }
  span.setAttributes(attributes);
}

/**
 * Inject OpenTelemetry trace context into HTTP headers for distributed tracing.
 * Adds traceparent, tracestate, and other propagation headers to the provided headers object.
 *
 * @param headers - Optional existing headers to inject trace context into
 * @returns Headers object with trace context injected
 *
 * @example
 * // With fetch
 * const headers = injectTraceHeaders({ 'Content-Type': 'application/json' });
 * await fetch(url, { headers });
 *
 * @example
 * // With HTTP client
 * const headers = injectTraceHeaders(existingHeaders);
 * await httpClient.request({ url, headers });
 */
export function injectTraceHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const carrier: Record<string, string> = { ...headers };
  propagation.inject(context.active(), carrier);
  return carrier;
}
