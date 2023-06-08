import opentelemetry from "@opentelemetry/api";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";

const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "deposit-screener",
    [SemanticResourceAttributes.SERVICE_VERSION]: "0.1.0",
  })
);

const collectorOptions = {
  url: "http://datadog-agent:4318/v1/metrics", // url is optional and can be omitted - default is http://localhost:4318/v1/metrics
  headers: {}, // an optional object containing custom headers to be sent with each request
  concurrencyLimit: 1, // an optional limit on pending requests
};
const metricExporter = new OTLPMetricExporter(collectorOptions);

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,

  // Default is 60000ms (60 seconds). Set to 3 seconds for demonstrative purposes only.
  exportIntervalMillis: 3000,
});

const myServiceMeterProvider = new MeterProvider({
  resource: resource,
});

myServiceMeterProvider.addMetricReader(metricReader);

// Set this MeterProvider to be global to the app being instrumented.
opentelemetry.metrics.setGlobalMeterProvider(myServiceMeterProvider);

console.log("Instrumentation file has been executed");
