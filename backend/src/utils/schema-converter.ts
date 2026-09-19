import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodSchema, ZodObject, ZodRawShape } from 'zod';

/**
 * Convert a Zod schema to JSON Schema for use in Fastify route definitions.
 * Fastify requires valid JSON Schema Draft-07 objects for route schemas,
 * but the codebase defines validation schemas in Zod. This utility bridges
 * the gap by converting Zod schemas to JSON Schema format.
 */

type FastifyJsonSchema = Record<string, unknown>;

function inlineDefinitions(schema: FastifyJsonSchema): FastifyJsonSchema {
  // Collect property schemas for #/properties/ refs
  const propDefs: Record<string, unknown> = {};
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        propDefs[key] = value;
      }
    }
  }

  // Also collect from #/components/schemas
  const compDefs = (schema['#/components/schemas'] as Record<string, unknown>) || {};
  
  const seen = new Set<string>();

  function resolve(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(resolve);
    }

    // Handle $ref
    if ('$ref' in obj && typeof obj.$ref === 'string') {
      const ref = obj.$ref as string;
      
      // Handle #/components/schemas/ refs
      if (ref.startsWith('#/components/schemas/')) {
        const refKey = ref.replace('#/components/schemas/', '');
        if (compDefs[refKey] && !seen.has(refKey)) {
          seen.add(refKey);
          return resolve(compDefs[refKey]);
        }
      }
      
      // Handle #/properties/ refs (sibling property references)
      if (ref.startsWith('#/properties/')) {
        const refKey = ref.replace('#/properties/', '');
        if (propDefs[refKey] && !seen.has(refKey)) {
          seen.add(refKey);
          return resolve(propDefs[refKey]);
        }
      }
      
      // Fallback: return a permissive schema for unresolved refs
      return { type: 'object', additionalProperties: true };
    }

    // Recurse into properties
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key !== '#/' && key !== '$ref' && key !== '#') {
        result[key] = resolve(value);
      }
    }
    return result;
  }

  const result = resolve(schema);
  // Remove the definitions sections
  delete result['#/components/schemas'];
  delete result['#/definitions'];
  return result as FastifyJsonSchema;
}

export function zodToJson(schema: ZodSchema): FastifyJsonSchema {
  const jsonSchema = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    errorReportingPath: 'additionalProperties',
    standalone: false,
    definitions: true,
    definitionPath: '#/components/schemas',
  }) as FastifyJsonSchema;

  return inlineDefinitions(jsonSchema);
}

/**
 * Build a Fastify-compatible response schema from a Zod schema.
 * Wraps the converted Zod schema in a standard response envelope.
 */
export function zodResponseSchema(schema: ZodSchema): FastifyJsonSchema {
  const jsonSchema = zodToJson(schema);
  return {
    type: 'object',
    properties: {
      data: jsonSchema,
    },
  } as FastifyJsonSchema;
}

/**
 * Build a Fastify-compatible error response schema.
 */
export function zodErrorResponseSchema(): FastifyJsonSchema {
  return {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          status: { type: 'number' },
          requestId: { type: 'string' },
          instance: { type: 'string' },
        },
      },
    },
  } as FastifyJsonSchema;
}
