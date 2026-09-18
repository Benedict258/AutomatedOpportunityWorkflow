import type { RawDocument, ExtractionContext, ExtractionResult, ExtractionWarning, ExtractionError } from './types';
import { Extractor } from './extractor.interface';

type Mapping = {
  field: string;
  path?: string; // dot notation
  selector?: string; // for HTML/text heuristics
  transform?: (value: unknown) => unknown;
  required?: boolean;
};

type SchemaDefinition = {
  contentType: string;
  mappings: Mapping[];
};

export class DeterministicExtractor implements Extractor {
  readonly name = 'deterministic-extractor';

  private schemas: Map<string, SchemaDefinition>;

  constructor(schemas?: SchemaDefinition[]) {
    this.schemas = new Map();
    if (schemas) {
      for (const s of schemas) {
        this.schemas.set(s.contentType.toLowerCase(), s);
      }
    }
  }

  canHandle(document: RawDocument, context: ExtractionContext): boolean {
    const ct = (document.contentType || context.contentType || '').toLowerCase();
    return this.schemas.has(ct) || this.isJsonLike(ct);
  }

  async extract(document: RawDocument, context: ExtractionContext): Promise<ExtractionResult> {
    const start = Date.now();
    const warnings: ExtractionWarning[] = [];
    const errors: ExtractionError[] = [];
    const fields: Record<string, unknown> = {};

    const ct = (document.contentType || context.contentType || '').toLowerCase();
    const schema = this.schemas.get(ct);

    const rawSizeBytes = typeof document.rawData === 'string' ? Buffer.byteLength(document.rawData, 'utf8') : undefined;

    try {
      const data = await this.normalize(document.rawData, ct);

      if (schema) {
        for (const m of schema.mappings) {
          const value = this.resolvePath(data, m.path || m.field);
          if (value === undefined || value === null) {
            if (m.required) {
              errors.push({ code: 'MISSING_REQUIRED', message: `Required field missing: ${m.field}`, field: m.field, recoverable: false });
            } else {
              warnings.push({ code: 'MISSING_OPTIONAL', message: `Optional field missing: ${m.field}`, field: m.field, severity: 'low' });
            }
            continue;
          }
          const transformed = m.transform ? m.transform(value) : value;
          fields[m.field] = transformed;
        }
      } else if (this.isJsonLike(ct)) {
        // Default JSON passthrough with safe pruning
        if (typeof data === 'object' && data !== null) {
          Object.assign(fields, this.safePrune(data));
        } else {
          warnings.push({ code: 'UNEXPECTED_JSON', message: 'JSON data is not an object', severity: 'medium' });
        }
      } else if (ct.includes('html')) {
        // Basic HTML metadata extraction
        const html = String(document.rawData || '');
        fields.title = this.extractTag(html, 'title');
        fields.metaDescription = this.extractMeta(html, 'description');
        fields.links = this.extractLinks(html);
      } else {
        // Text fallback
        const text = String(document.rawData || '');
        fields.text = text.slice(0, 5000);
        warnings.push({ code: 'TEXT_FALLBACK', message: 'Used text fallback extraction', severity: 'low' });
      }

      const confidence = this.computeConfidence(fields, errors, warnings);
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
          contentType: ct as any,
          rawSizeBytes,
          processingMs: Date.now() - start,
        },
        rawPreview,
      };
    } catch (e: any) {
      errors.push({ code: 'EXTRACTION_FAILED', message: e.message || 'Deterministic extraction failed', recoverable: true });
      return {
        documentId: document.documentId,
        sourceId: document.sourceId,
        extractedAt: new Date().toISOString(),
        fields,
        confidence: 0,
        warnings,
        errors,
        provenance: {
          extractor: this.name,
          contentType: ct as any,
          rawSizeBytes,
          processingMs: Date.now() - start,
        },
      };
    }
  }

  private async normalize(raw: unknown, ct: string): Promise<any> {
    if (ct.includes('json') || this.isJsonLike(ct)) {
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    }
    return raw;
  }

  private isJsonLike(ct: string): boolean {
    return ct.includes('json') || (typeof ct === 'string' && ct === 'application/json');
  }

  private resolvePath(obj: any, path?: string): unknown {
    if (!path) return obj;
    return path.split('.').reduce((acc: any, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
  }

  private safePrune(obj: any, maxKeys = 200): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    const out: any = {};
    let count = 0;
    for (const k of Object.keys(obj)) {
      if (count >= maxKeys) break;
      try {
        out[k] = obj[k];
        count++;
      } catch {}
    }
    return out;
  }

  private extractTag(html: string, tag: string): string | undefined {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = html.match(re);
    return m?.[1]?.trim();
  }

  private extractMeta(html: string, name: string): string | undefined {
    const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
    const m = html.match(re);
    return m?.[1]?.trim();
  }

  private extractLinks(html: string): string[] {
    const links: string[] = [];
    const re = /<a[^>]+href=["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html)) && links.length < 100) {
      links.push(m[1]);
    }
    return links;
  }

  private computeConfidence(fields: Record<string, unknown>, errors: ExtractionError[], warnings: ExtractionWarning[]): number {
    if (errors.length > 0) return Math.max(0, 0.5 - errors.length * 0.1);
    const base = 0.85;
    const warningPenalty = warnings.length * 0.03;
    const fieldBonus = Math.min(0.1, Object.keys(fields).length * 0.005);
    return Math.min(1, Math.max(0, base - warningPenalty + fieldBonus));
  }

  getCapabilities() {
    return {
      contentTypes: Array.from(this.schemas.keys()),
      deterministic: true,
    };
  }
}
