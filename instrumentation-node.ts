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
    // Dynamic import — only initializes if packages are installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdkNodeMod = await import('@opentelemetry/sdk-node' as any)
    const autoInstrMod = await import('@opentelemetry/auto-instrumentations-node' as any)
    const resourceMod = await import('@opentelemetry/resources' as any)

    const sdk = new sdkNodeMod.NodeSDK({
      resource: new resourceMod.Resource({ 'service.name': 'deepmindq' }),
      instrumentations: [autoInstrMod.getNodeAutoInstrumentations()],
    })

    sdk.start()
    console.info('[OTel] OpenTelemetry SDK initialized')
  } catch (_err) {
    // OTel packages not installed — graceful fallback
    console.info('[OTel] OpenTelemetry packages not installed, using lightweight tracing fallback')
  }
}

export { registerNodeOTel }
