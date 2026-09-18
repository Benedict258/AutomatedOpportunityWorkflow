#!/usr/bin/env npx tsx
/**
 * NVIDIA Nemotron Live Verification Script
 * 
 * Tests the NVIDIA Nemotron model via the OpenAI-compatible API
 * 
 * Requirements:
 * - NVIDIA_API_KEY environment variable set
 * - Valid NVIDIA API key with access to Nemotron models
 * 
 * Usage:
 *   npx tsx scripts/test-nemotron.ts
 */

import { UnifiedModelService } from '../shared/src/models/unified-service';
import { ModelOperation } from '../shared/src/models/types';

async function runNemotronTests() {
  console.log('=== NVIDIA Nemotron Live Verification ===\n');
  
  // Check for API key
  if (!process.env.NVIDIA_API_KEY) {
    console.error('❌ FAIL — NVIDIA_API_KEY environment variable not set');
    console.log('   Set NVIDIA_API_KEY in your .env file');
    process.exit(1);
  }
  
  console.log('✅ NVIDIA_API_KEY found');
  console.log(`   Key prefix: ${process.env.NVIDIA_API_KEY.substring(0, 8)}...`);
  
  const modelService = new UnifiedModelService();
  
  try {
    await modelService.initialize();
    console.log('✅ Model service initialized');
  } catch (error) {
    console.error('❌ FAIL — Model service initialization failed:', (error as Error).message);
    process.exit(1);
  }
  
  const registry = modelService.getRegistry();
  
  // Test 1: Health Check
  console.log('\n--- Test 1: Provider Health Check ---');
  try {
    const health = await registry.healthCheck('nemotron-3-ultra');
    console.log(`Provider: ${health.providerId}`);
    console.log(`Model: ${health.modelId}`);
    console.log(`Healthy: ${health.healthy}`);
    console.log(`Latency: ${health.latencyMs}ms`);
    if (health.error) {
      console.log(`Error: ${health.error}`);
    }
    
    if (!health.healthy) {
      console.log('⚠️  Health check failed - but continuing with tests');
    } else {
      console.log('✅ Health check passed');
    }
  } catch (error) {
    console.error('❌ FAIL — Health check error:', (error as Error).message);
  }
  
  // Test 2: Simple Generation
  console.log('\n--- Test 2: Simple Generation ---');
  try {
    const result = await modelService.generate('reasoning', {
      prompt: 'Respond with exactly one sentence explaining why structured data validation is important in an AI pipeline.',
      systemPrompt: 'You are a helpful assistant. Respond concisely.',
      temperature: 0.1,
      maxTokens: 256,
    });
    
    if (result.success) {
      console.log('✅ Generation succeeded');
      console.log(`Response: ${result.data?.text?.substring(0, 200)}...`);
      console.log(`Latency: ${result.executionRecord.latencyMs}ms`);
      console.log(`Tokens: ${result.executionRecord.tokenUsage?.totalTokens || 'N/A'}`);
      console.log(`Model: ${result.executionRecord.modelId}`);
      console.log(`Provider: ${result.executionRecord.providerId}`);
    } else {
      console.error('❌ FAIL — Generation failed:', result.error?.message);
      console.log(`Error category: ${result.executionRecord.errorCategory}`);
    }
  } catch (error) {
    console.error('❌ FAIL — Generation error:', (error as Error).message);
  }
  
  // Test 3: Structured Output (Extraction)
  console.log('\n--- Test 3: Structured Output (Extraction) ---');
  try {
    const extractionSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        skills: { type: 'array', items: { type: 'string' } },
        deadline: { type: ['string', 'null'], format: 'date' },
        requirements: { type: 'array', items: { type: 'string' } }
      },
      required: ['title', 'skills', 'deadline', 'requirements'],
      additionalProperties: false
    };
    
    const result = await modelService.generateStructured('extraction', {
      prompt: `Extract structured information from this opportunity:

"Software engineering internship requiring Python, Git and REST API experience. Applications close December 15."`,
      systemPrompt: 'You are an expert at extracting structured information from job postings.',
      schema: extractionSchema,
      temperature: 0.1,
      maxTokens: 1024,
    });
    
    if (result.success) {
      console.log('✅ Structured extraction succeeded');
      console.log('Response:', JSON.stringify(result.data?.data, null, 2));
      console.log(`Latency: ${result.executionRecord.latencyMs}ms`);
      console.log(`Tokens: ${result.executionRecord.tokenUsage?.totalTokens || 'N/A'}`);
      
      // Validate response structure
      const data = result.data?.data as any;
      if (data && data.title && Array.isArray(data.skills) && data.deadline !== undefined && Array.isArray(data.requirements)) {
        console.log('✅ Response matches expected schema');
      } else {
        console.log('⚠️  Response structure validation: incomplete fields');
      }
    } else {
      console.error('❌ FAIL — Structured extraction failed:', result.error?.message);
      console.log(`Validation errors: ${result.executionRecord.validationErrors?.join(', ') || 'N/A'}`);
    }
  } catch (error) {
    console.error('❌ FAIL — Structured extraction error:', (error as Error).message);
  }
  
  // Test 4: Classification
  console.log('\n--- Test 4: Classification ---');
  try {
    const classificationSchema = {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              categoryId: { type: 'string' },
              categoryName: { type: 'string' },
              confidenceScore: { type: 'number', minimum: 0, maximum: 1 },
              reasoning: { type: 'string' }
            },
            required: ['categoryId', 'categoryName', 'confidenceScore']
          }
        }
      },
      required: ['categories'],
      additionalProperties: false
    };
    
    const result = await modelService.generateStructured('classification', {
      prompt: `Classify this opportunity into taxonomy categories:

"Senior Software Engineer at Acme Corp. 5+ years Python, React, AWS. Remote. $150k-200k. US Citizenship required."

Categories: WORK, TECHNICAL EXPERIENCE, CYBERSECURITY, GOVERNMENT, POLICY, INTERNATIONAL AFFAIRS, FELLOWSHIP, EDUCATION, EVENTS, NEWS`,
      systemPrompt: 'You are a taxonomy classifier for opportunities. Return JSON array of categories with confidence scores.',
      schema: classificationSchema,
      temperature: 0,
      maxTokens: 1024,
    });
    
    if (result.success) {
      console.log('✅ Classification succeeded');
      console.log('Response:', JSON.stringify(result.data?.data, null, 2));
      console.log(`Latency: ${result.executionRecord.latencyMs}ms`);
    } else {
      console.error('❌ FAIL — Classification failed:', result.error?.message);
    }
  } catch (error) {
    console.error('❌ FAIL — Classification error:', (error as Error).message);
  }
  
  // Test 5: Reasoning/Explanation
  console.log('\n--- Test 5: Reasoning (Explanation) ---');
  try {
    const explanationSchema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        strengths: { type: 'array', items: { type: 'string' } },
        gaps: { type: 'array', items: { type: 'string' } },
        eligibilityNotes: { type: 'string' },
        preparation: { type: 'array', items: { type: 'string' } },
        uncertainties: { type: 'array', items: { type: 'string' } }
      },
      required: ['summary', 'strengths', 'gaps', 'eligibilityNotes', 'preparation', 'uncertainties'],
      additionalProperties: false
    };
    
    const result = await modelService.generateStructured('reasoning', {
      prompt: `Explain the match for this candidate:

OPPORTUNITY: Senior Software Engineer at Acme Corp. Python, React, AWS. Remote. $150k-200k. Deadline: 2025-03-15. US Citizenship required.

CANDIDATE: Python 7 years, React 5 years, AWS 4 years, TypeScript 3 years, Kubernetes 2 years. US Citizen. Masters CS. Remote preference.

MATCH FACTORS:
- Career Alignment: 0.90
- Skill Alignment: 0.85
- Eligibility: 1.00 (ELIGIBLE)
- Experience Fit: 0.80
- Education Fit: 0.90
- Opportunity Value: 0.80
- Location/Remote Fit: 1.00
- Timing: 0.85

FINAL SCORE: 0.87`,
      systemPrompt: 'You are explaining an already-computed opportunity intelligence result. You MUST NOT change eligibility, score, ranking, deadline, or source facts. Use only supplied evidence. Say "Unknown" if missing.',
      schema: explanationSchema,
      temperature: 0.3,
      maxTokens: 2048,
    });
    
    if (result.success) {
      console.log('✅ Reasoning succeeded');
      console.log('Response:', JSON.stringify(result.data?.data, null, 2));
      console.log(`Latency: ${result.executionRecord.latencyMs}ms`);
    } else {
      console.error('❌ FAIL — Reasoning failed:', result.error?.message);
    }
  } catch (error) {
    console.error('❌ FAIL — Reasoning error:', (error as Error).message);
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  const stats = modelService.getObservability().getBufferSize();
  console.log(`Observability buffer size: ${stats}`);
  
  await modelService.shutdown();
  console.log('\n✅ All tests completed');
}

// Run tests
runNemotronTests().catch(console.error);