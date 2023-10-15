import * as ot from "@opentelemetry/api";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";

let SERVICE_METER_PROVIDER: MeterProvider;

export function setupDefaultInstrumentation(
  serviceName: string,
  serviceVersion = "0.1.0"
): void {
  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    })
  );

  const metricExporter = new OTLPMetricExporter();
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 30_000,
  });

  SERVICE_METER_PROVIDER = new MeterProvider({
    resource: resource,
  });

  SERVICE_METER_PROVIDER.addMetricReader(metricReader);
  ot.metrics.setGlobalMeterProvider(SERVICE_METER_PROVIDER);
  console.log("Instrumentation setup complete");
}

export function makeCreateCounterFn(
  meter: ot.Meter,
  actor: string,
  component: string
): (label: string, description: string, unit?: string) => ot.Counter {
  return (label: string, description: string, unit?: string) => {
    return meter.createCounter(formatMetricLabel(actor, component, label), {
      description,
      unit,
    });
  };
}

export function makeCreateHistogramFn(
  meter: ot.Meter,
  actor: string,
  component: string
): (label: string, description: string, unit?: string) => ot.Histogram {
  return (label: string, description: string, unit?: string) => {
    return meter.createHistogram(formatMetricLabel(actor, component, label), {
      description,
      unit,
    });
  };
}

export function formatMetricLabel(
  actor: string,
  component: string,
  label: string
): string {
  return `nocturne.${actor}.${component}.${label}`;
}

export function forceFlushAll(): Promise<void> {
  return SERVICE_METER_PROVIDER.forceFlush();
}