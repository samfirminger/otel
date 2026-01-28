import "./telemetry/instrumentation";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { httpInstrumentationMiddleware } from '@hono/otel';
import { getServiceName, getServiceVersion } from './telemetry';

const app = new Hono();

app.use('*', httpInstrumentationMiddleware({
  serviceName: getServiceName(),
  serviceVersion: getServiceVersion(),
}));

app
  .get("/", (c) => {
    return c.text("healthy");
  })

  .get("/ping", (c) => {
    return c.text("Hello Hono!");
  })
  .get('/error', (c) => {
    return c.text("Something went wrong", 400);
  });

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
