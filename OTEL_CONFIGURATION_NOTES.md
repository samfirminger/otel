# OpenTelemetry Configuration Differences

## The Problem

In this `otel-spike` repository, traces weren't showing up until we explicitly configured a trace exporter in the NodeSDK. However, in the `meta` repository, the same NodeSDK setup works without an explicit exporter.

## Root Cause: Automatic Exporter Configuration

The OpenTelemetry NodeSDK has built-in support for **automatic exporter configuration** via environment variables. According to the [OpenTelemetry documentation](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/), if you don't provide an explicit `traceExporter` to the NodeSDK constructor, it will automatically create one based on environment variables.

## Key Environment Variables

### Required for Automatic Configuration

1. **`OTEL_EXPORTER_OTLP_ENDPOINT`** - The collector endpoint URL
   - Example: `http://localhost:4318` (HTTP) or `http://localhost:4317` (gRPC)

2. **`OTEL_EXPORTER_OTLP_PROTOCOL`** - The protocol to use
   - Options: `http/protobuf`, `grpc`, `http/json`
   - **This is the key variable that was missing in otel-spike**
   - Without this, the SDK behavior is version-dependent and may not configure the exporter

### Current Configuration

**otel-spike (.env)**
```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_LOG_LEVEL=debug
```

**meta (likely has)**
```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc  # or set via deployment config
```

## Why Explicit Configuration Was Needed

### Current Setup (What We Did)
```typescript
const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
});

const sdk = new NodeSDK({
  resource,
  instrumentations,
  traceExporter,  // Explicit exporter
});
```

This works because we're explicitly telling the SDK where and how to export traces.

### What Could Work Instead (Automatic Configuration)
```typescript
// In .env, add:
// OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf

const sdk = new NodeSDK({
  resource,
  instrumentations,
  // No traceExporter - SDK auto-configures from env vars
});
```

## HTTP vs gRPC: Export Protocol vs Application Protocol

**CRITICAL DISTINCTION**: The OTLP export protocol (gRPC vs HTTP) is **completely separate** from your application's traffic protocol.

### What the Export Protocol Controls

The `OTEL_EXPORTER_OTLP_PROTOCOL` setting determines **how traces are sent from your app to the collector**, NOT what kind of traffic is being traced.

```
Your Application Traffic     Export Protocol to Collector
--------------------         ---------------------------
HTTP requests        \
gRPC calls            \      Could export via gRPC
WebSocket connections  >---> OR
Database queries      /      Could export via HTTP
File system ops      /
```

### Example: You Can Mix Protocols

```typescript
// Your app handles HTTP requests (instrumented by @hono/otel)
app.get('/api/users', async (c) => {
  // Makes a gRPC call to another service (instrumented by auto-instrumentations)
  const response = await grpcClient.getUser();
  // Makes HTTP call to database
  await fetch('http://database/query');
});

// ALL of the above traces are sent to collector using ONE export protocol:
// Either OTLP/gRPC or OTLP/HTTP (your choice, independent of app traffic)
```

### Why We Used HTTP

1. **Endpoint URL Format**
   - HTTP: `http://localhost:4318/v1/traces` (explicit path required)
   - gRPC: `http://localhost:4317` (path handled by protocol)

2. **Initial .env Configuration**
   - Our `.env` had port 4318 (HTTP port)
   - Package initially installed: `@opentelemetry/exporter-trace-otlp-grpc`
   - Mismatch required switching to HTTP exporter

3. **Collector Configuration**
   - Both protocols are supported by the collector
   - HTTP receiver: `0.0.0.0:4318`
   - gRPC receiver: `0.0.0.0:4317`

### What Gets Auto-Instrumented (Regardless of Export Protocol)

The `getNodeAutoInstrumentations()` package automatically instruments:
- **HTTP/HTTPS** requests (via `@opentelemetry/instrumentation-http`)
- **gRPC** calls (via `@opentelemetry/instrumentation-grpc`)
- **Database** queries (Postgres, MySQL, Redis, etc.)
- **Express, Koa, Fastify** frameworks
- Many other protocols and libraries

All of these create traces that are then exported to the collector using your chosen OTLP protocol.

### Either Protocol Works

You can use either protocol, just need consistency:

**Option 1: gRPC (meta likely uses this)**
```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4317',
});
```

**Option 2: HTTP (what we implemented)**
```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
});
```

## Why meta Repository Works Differently

Possible reasons the meta repository doesn't need explicit exporter configuration:

1. **Environment Variable Present**
   - `OTEL_EXPORTER_OTLP_PROTOCOL` is set in deployment config or docker-compose
   - Cloud Run or other deployment platform sets it automatically

2. **Different Loading Mechanism**
   - Environment variables loaded before SDK initialization
   - Possibly using a different method than `--env-file`

3. **SDK Version Differences**
   - Different versions of `@opentelemetry/sdk-node` may have different defaults
   - Newer versions might auto-detect protocol from endpoint URL

## Zpages Limitation

**Important Discovery:** The zpages UI (`http://localhost:55679/debug/tracez`) only shows traces generated BY the collector itself, not traces passing THROUGH it. This is why we couldn't see application traces there even when they were being exported successfully.

To visualize traces, use:
- Jaeger UI: `http://localhost:16686`
- Debug exporter: View collector docker logs
- Grafana + Tempo (not configured)

## Recommended Solutions

### Option A: Add Missing Environment Variable (Cleanest)
Add to `.env`:
```env
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

Remove explicit exporter from `instrumentation.ts` to match meta repo pattern.

### Option B: Keep Explicit Configuration (Current)
Keep the current setup with explicit `OTLPTraceExporter` for maximum control and clarity.

### Option C: Switch to gRPC (Match meta)
1. Change `.env` endpoint to port 4317
2. Use `@opentelemetry/exporter-trace-otlp-grpc`
3. Or remove explicit exporter and set `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`

## Additional Components Required

### Hono Middleware
Unlike traditional Node.js HTTP servers, Hono requires explicit middleware for tracing:

```typescript
import { httpInstrumentationMiddleware } from '@hono/otel';

app.use('*', httpInstrumentationMiddleware({
  serviceName: getServiceName(),
  serviceVersion: getServiceVersion(),
}));
```

This is required in both repositories because the auto-instrumentations don't capture Hono's fetch-based API.

## References

- [OpenTelemetry Environment Variables](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/)
- [OTLP Exporter Configuration](https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/)
- [NodeSDK Documentation](https://open-telemetry.github.io/opentelemetry-js/modules/_opentelemetry_sdk-node.html)
- [GitHub Issue #2873](https://github.com/open-telemetry/opentelemetry-js/issues/2873) - NodeSDK support for OTEL_TRACES_EXPORTER