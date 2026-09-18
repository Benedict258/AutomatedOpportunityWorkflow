import type { RawDocument, ExtractionContext, ExtractionResult, ExtractedFields, ExtractionWarning, ExtractionError } from './types';
import { Extractor } from './extractor.interface';

export interface LLMExtractionConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  promptTemplate?: string;
  schema?: Record<string, unknown>;
}

export interface LLMClient {
  complete(prompt: string, options?: LLMExtractionConfig): Promise<string>;
}

export abstract class LLMEractionAdapter implements Extractor {
  readonly name: string;

  protected config: LLMExtractionConfig;
  protected client?: LLMClient;

  constructor(name: string, config?: LLMExtractionConfig) {
    this.name = name;
    this.config = {
      model: process.env.EXTRACTION_MODEL || config?.model,
      temperature: config?.temperature ?? 0,
      maxTokens: config?.maxTokens ?? 2000,
      ...config,
    };
  }

  abstract canHandle(document: RawDocument, context: ExtractionContext): boolean;

  protected abstract getPrompt(document: RawDocument, context: ExtractionContext): string;

  protected abstract parseLLMOutput(output: string, document: RawDocument, context: ExtractionContext): { fields: ExtractedFields; warnings: ExtractionWarning[] };

  async extract(document: RawDocument, context: ExtractionContext): Promise<ExtractionResult> {
    const start = Date.now();
    const warnings: ExtractionWarning[] = [];
    const errors: ExtractionError[] = [];

    if (!this.client) {
      errors.push({ code: 'LLM_CLIENT_UNCONFIGURED', message: 'LLM client not configured', recoverable: false });
      return this.buildResult(document, context, {}, 0, warnings, errors, start);
    }

    try {
      const prompt = this.getPrompt(document, context);
      const output = await this.client.complete(prompt, this.config);

      if (!output || !output.trim()) {
        warnings.push({ code: 'LLM_EMPTY_OUTPUT', message: 'LLM returned empty output', severity: 'medium' });
      }

      const { fields, warnings: parseWarnings } = this.parseLLMOutput(output || '', document, context);
      warnings.push(...parseWarnings);

      const confidence = this.computeConfidence(fields, warnings);
      return this.buildResult(document, context, fields, confidence, warnings, errors, start);
    } catch (e: any) {
      errors.push({ code: 'LLM_EXTRACTION_FAILED', message: e.message || 'LLM extraction failed', recoverable: true });
      return this.buildResult(document, context, {}, 0, warnings, errors, start);
    }
  }

  setClient(client: LLMClient): void {
    this.client = client;
  }

  getCapabilities() {
    return {
      contentTypes: ['text/plain', 'text/html', 'application/json', 'application/xml'],
      supportsLLM: true,
      deterministic: false,
    };
  }

  protected buildResult(
    document: RawDocument,
    context: ExtractionContext,
    fields: ExtractedFields,
    confidence: number,
    warnings: ExtractionWarning[],
    errors: ExtractionError[],
    start: number
  ): ExtractionResult {
    const rawSizeBytes = typeof document.rawData === 'string' ? Buffer.byteLength(document.rawData, 'utf8') : undefined;
    const rawPreview = typeof document.rawData === 'string' ? document.rawData.slice(0, 1000) : undefined;
    return {
      documentId: document.documentId,
      sourceId: document.sourceId,
      extractedAt: new Date().toISOString(),
      fields,
      confidence,
      warnings,
      errors,
      provenance: {
        extractor: this.name,
        contentType: context.contentType,
        rawSizeBytes,
        processingMs: Date.now() - start,
      },
      rawPreview,
    };
  }

  protected computeConfidence(fields: ExtractedFields, warnings: ExtractionWarning[]): number {
    const fieldCount = Object.keys(fields).length;
    const base = fieldCount > 0 ? 0.7 : 0.2;
    const warningPenalty = warnings.length * 0.05;
    return Math.min(1, Math.max(0, base - warningPenalty));
  }
}

/**
 * Generic LLM extractor that can be specialized for different content types.
 * No direct persistence — results are returned to the orchestration layer.
 */
export class GenericLLMExtractor extends LLMEractionAdapter {
  readonly name = 'generic-llm-extractor';

  constructor(config?: LLMExtractionConfig) {
    super('generic-llm-extractor', config);
  }

  canHandle(document: RawDocument, context: ExtractionContext): boolean {
    // Accept text-like content as fallback
    const ct = (context.contentType || '').toLowerCase();
    return ct.includes('text') || ct.includes('html') || ct.includes('json') || ct.includes('xml');
  }

  protected getPrompt(document: RawDocument, context: ExtractionContext): string {
    const template = this.config.promptTemplate || `Extract structured fields from the following content.
Content-Type: ${context.contentType}
Return JSON only with fields as key-value pairs.

Content:
${this.truncate(String(document.rawData || ''), 12000)}
`;
    return template;
  }

  protected parseLLMOutput(output: string, _document: RawDocument, _context: ExtractionContext): { fields: ExtractedFields; warnings: ExtractionWarning[] } {
    const warnings: ExtractionWarning[] = [];
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : output;
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || parsed === null) {
        warnings.push({ code: 'LLM_PARSE_NON_OBJECT', message: 'LLM output parsed to non-object', severity: 'medium' });
        return { fields: {}, warnings };
      }
      return { fields: parsed, warnings };
    } catch (e: any) {
      warnings.push({ code: 'LLM_PARSE_ERROR', message: `Failed to parse LLM output as JSON: ${e.message}`, severity: 'high' });
      // Attempt best-effort extraction
      return { fields: { raw_output: output.slice(0, 2000) }, warnings };
    }
  }

  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max) + '...' : s;
  }
}
