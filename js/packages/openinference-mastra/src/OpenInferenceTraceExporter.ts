import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { addOpenInferenceAttributesToSpan } from "@arizeai/openinference-vercel/utils";

import { addOpenInferenceAttributesToMastraSpan } from "./attributes.js";
import { addOpenInferenceProjectResourceAttributeSpan } from "./utils.js";

type ConstructorArgs = {
  /**
   * A function that filters the spans to be exported.
   * If provided, the span will be exported if the function returns `true`.
   *
   * @example
   * ```ts
   * import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
   * import { isOpenInferenceSpan, OpenInferenceOTLPTraceExporter } from "@arizeai/openinference-mastra";
   * const spanFilter = (span: ReadableSpan) => {
   *   // add more span filtering logic here if desired
   *   // or just use the default isOpenInferenceSpan filter directly
   *   return isOpenInferenceSpan(span);
   * };
   * const exporter = new OpenInferenceOTLPTraceExporter({
   *   url: "...",
   *   headers: "...",
   *   spanFilter,
   * });
   * ```
   */
  spanFilter?: (span: ReadableSpan) => boolean;
} & NonNullable<ConstructorParameters<typeof OTLPTraceExporter>[0]>;

/**
 * A custom OpenTelemetry trace exporter that appends OpenInference semantic conventions to spans prior to export
 *
 * This class extends the `OTLPTraceExporter` and adds additional logic to the `export` method to augment the spans with OpenInference attributes.
 *
 * @example
 * ```ts
 * import { Mastra } from "@mastra/core/mastra";
 * import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
 * import { isOpenInferenceSpan, OpenInferenceOTLPTraceExporter } from "@arizeai/openinference-mastra";
 * const spanFilter = (span: ReadableSpan) => {
 *   // add more span filtering logic here if desired
 *   // or just use the default isOpenInferenceSpan filter directly
 *   return isOpenInferenceSpan(span);
 * };
 * const exporter = new OpenInferenceOTLPTraceExporter({
 *   apiKey: "api-key",
 *   collectorEndpoint: "http://localhost:6006/v1/traces",
 *   spanFilter,
 * });
 * const mastra = new Mastra({
 *   // ... other config
 *   telemetry: {
 *     export: {
 *       type: "custom",
 *       exporter,
 *     },
 *   },
 * })
 * ```
 */
export class OpenInferenceOTLPTraceExporter extends OTLPTraceExporter {
  private readonly spanFilter?: (span: ReadableSpan) => boolean;

  constructor({ spanFilter, ...args }: ConstructorArgs) {
    super({
      ...args,
    });
    this.spanFilter = spanFilter;
  }
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ) {
    let filteredSpans = spans.map((span) => {
      // add OpenInference resource attributes to the span based on Mastra span attributes
      addOpenInferenceProjectResourceAttributeSpan(span);
      // add OpenInference attributes to the span based on Vercel span attributes
      addOpenInferenceAttributesToSpan({
        ...span,
        // backwards compatibility with older versions of sdk-trace-base
        instrumentationLibrary: {
          name: "@arizeai/openinference-mastra",
        },
      });
      // add OpenInference attributes to the span based on Mastra span attributes
      addOpenInferenceAttributesToMastraSpan(span);
      return span;
    });
    if (this.spanFilter) {
      filteredSpans = filteredSpans.filter(this.spanFilter);
    }
    super.export(filteredSpans, resultCallback);
  }
}
