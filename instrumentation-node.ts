/**
 * instrumentation-node.ts — OpenTelemetry SDK Initialization
 *
 * NOT imported directly by Next.js. This file is referenced in next.config.js
 * or src/instrumentation.ts only when OTel packages are installed.
 *
 * This file registers the full OTel Node.js SDK with auto-instrumentations.
 * It only runs in Node.js runtime, never in Edge.
 *
 * Usage:
 *   1. Install: npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-grpc
 *   2. Add to src/instrumentation.ts: import('./instrumentation-node')
 *   3. Set OTEL_EXPORTER_OTLP_ENDPOINT in .env
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

async function registerNodeOTel() {
  try {
    const { env } = await import('@/lib/env-config');
    // Dynamic import — only initializes if packages are installed
    const sdkNodeMod = await import('@opentelemetry/sdk-node' as any)
    const autoInstrMod = await import('@opentelemetry/auto-instrumentations-node' as any)
    const resourceMod = await import('@opentelemetry/resources' as any)

    const OTEL_ENDPOINT = env.otelExporterEndpoint

    // Build resource attributes for trace correlation in the observability backend
    const resource = new resourceMod.Resource({
      'service.name': env.otelServiceName,
      'service.version': env.appVersion,
      'deployment.environment': env.deployEnvironment,
      'deploy.slot': env.deploySlot,
      'deploy.region': env.deployRegion,
    })

    // Auto-instrumentations — disable filesystem instrumentation to reduce noise
    const instrumentations = [
      autoInstrMod.getNodeAutoInstrumentations({
        // Disable expensive/noisy instrumentations
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ]

    let traceExporter: any = undefined

    if (OTEL_ENDPOINT) {
      try {
        // Use OTLP gRPC exporter when endpoint is configured
        const otlpExporter = await import('@opentelemetry/exporter-trace-otlp-grpc' as any)
        traceExporter = new otlpExporter.OTLPTraceExporter({
          url: OTEL_ENDPOINT,
        })
        console.info(`[OTel] Configured OTLP gRPC exporter to ${OTEL_ENDPOINT}`)
      } catch (grpcErr) {
        // gRPC exporter not available — try HTTP exporter as fallback
        console.info('[OTel] gRPC exporter not available, trying HTTP exporter')
        try {
          const otlpHttpExporter = await import('@opentelemetry/exporter-trace-otlp-http' as any)
          traceExporter = new otlpHttpExporter.OTLPTraceExporter({
            url: OTEL_ENDPOINT.replace(/:4317$/, ':4318'), // gRPC → HTTP port
          })
          console.info(`[OTel] Configured OTLP HTTP exporter to ${OTEL_ENDPOINT.replace(/:4317$/, ':4318')}`)
        } catch (httpErr) {
          console.info('[OTel] No OTLP exporter available, traces will be logged to console only')
        }
      }
    } else {
      console.info('[OTel] No OTEL_EXPORTER_OTLP_ENDPOINT configured — traces available locally only')
    }

    const sdk = new sdkNodeMod.NodeSDK({
      resource,
      instrumentations,
      ...(traceExporter ? { spanExporter: traceExporter } : {}),
    })

    sdk.start()
    console.info('[OTel] OpenTelemetry SDK initialized')
  } catch (_err) {
    // OTel packages not installed — graceful fallback
    console.info('[OTel] OpenTelemetry packages not installed, using lightweight tracing fallback')
  }
}

export { registerNodeOTel }
