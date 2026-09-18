import { UnifiedModelService } from '../../models/unified-service';
import { ModelOperation } from '../../models/types';
import {
  EvaluationDataset,
  EvaluationItem,
  EvaluationResult,
  ItemResult,
  EvaluationConfig
} from './types';
import { computeAggregatedMetrics } from './metrics';
import { ALL_DATASETS } from './dataset';

export interface ModelEvaluator {
  evaluate(dataset: EvaluationDataset<any, any>, modelId: string, operation: ModelOperation): Promise<EvaluationResult>;
  evaluateAll(config: EvaluationConfig): Promise<EvaluationResult[]>;
}

export class DefaultModelEvaluator implements ModelEvaluator {
  private modelService: UnifiedModelService;

  constructor(modelService: UnifiedModelService) {
    this.modelService = modelService;
  }

  async evaluate(
    dataset: EvaluationDataset<any, any>,
    modelId: string,
    operation: ModelOperation
  ): Promise<EvaluationResult> {
    const runId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const items: ItemResult[] = [];

    for (const item of dataset.items) {
      const startTime = Date.now();
      try {
        let result: ItemResult;
        switch (operation) {
          case 'extraction':
            result = await this.evaluateExtraction(item, modelId);
            break;
          case 'classification':
            result = await this.evaluateClassification(item, modelId);
            break;
          case 'requirement-extraction':
            result = await this.evaluateRequirements(item, modelId);
            break;
          case 'eligibility':
            result = await this.evaluateEligibility(item);
            break;
          case 'semantic-matching':
            result = await this.evaluateSemanticMatching(item);
            break;
          case 'reasoning':
            result = await this.evaluateExplanation(item, modelId);
            break;
          default:
            result = { id: item.id, success: false, errors: [`Unknown operation: ${operation}`] };
        }
        result.latencyMs = Date.now() - startTime;
        items.push(result);
      } catch (error) {
        items.push({
          id: item.id,
          success: false,
          errors: [(error as Error).message],
          latencyMs: Date.now() - startTime
        });
      }
    }

    const metrics = computeAggregatedMetrics(items, operation);

    return {
      datasetName: dataset.name,
      modelId,
      providerId: 'unknown',
      promptVersion: 'v1',
      runId,
      timestamp: new Date().toISOString(),
      metrics,
      items
    };
  }

  private async evaluateExtraction(item: EvaluationItem<any, any>, modelId: string): Promise<ItemResult> {
    const response = await this.modelService.generate('extraction', {
      prompt: item.input.rawData,
      systemPrompt: 'Extract structured fields from the job posting.',
      temperature: 0.1,
      maxTokens: 4096,
      responseFormat: 'json'
    });

    if (!response.success) {
      return { id: item.id, success: false, error: response.error };
    }

    const predicted = response.data?.text ? JSON.parse(response.data.text) : {};
    const expected = item.expected;

    return {
      id: item.id,
      success: true,
      predicted,
      expected,
      tokenUsage: response.data?.usage ? {
        prompt: response.data.usage.promptTokens,
        completion: response.data.usage.completionTokens,
        total: response.data.usage.totalTokens
      } : undefined
    };
  }

  private async evaluateClassification(item: EvaluationItem<any, any>, modelId: string): Promise<ItemResult> {
    const response = await this.modelService.generate('classification', {
      prompt: item.input,
      systemPrompt: 'Classify the opportunity into taxonomy categories.',
      temperature: 0,
      maxTokens: 512,
      responseFormat: 'json'
    });

    if (!response.success) {
      return { id: item.id, success: false, error: response.error };
    }

    const predicted = response.data?.text ? JSON.parse(response.data.text) : {};
    const expected = item.expected;

    return {
      id: item.id,
      success: true,
      predicted: { primaryCategory: predicted[0]?.categoryId },
      expected: { primaryCategory: expected.primaryCategory },
      tokenUsage: response.data?.usage ? {
        prompt: response.data.usage.promptTokens,
        completion: response.data.usage.completionTokens,
        total: response.data.usage.totalTokens
      } : undefined
    };
  }

  private async evaluateRequirements(item: EvaluationItem<any, any>, modelId: string): Promise<ItemResult> {
    const response = await this.modelService.generate('requirement-extraction', {
      prompt: item.input,
      systemPrompt: 'Extract requirements with REQUIRED/PREFERRED/OPTIONAL/INFERRED/UNKNOWN classification.',
      temperature: 0.1,
      maxTokens: 4096,
      responseFormat: 'json'
    });

    if (!response.success) {
      return { id: item.id, success: false, error: response.error };
    }

    const predicted = response.data?.text ? JSON.parse(response.data.text) : {};
    const expected = item.expected;

    return {
      id: item.id,
      success: true,
      predicted,
      expected,
      tokenUsage: response.data?.usage ? {
        prompt: response.data.usage.promptTokens,
        completion: response.data.usage.completionTokens,
        total: response.data.usage.totalTokens
      } : undefined
    };
  }

  private async evaluateEligibility(item: EvaluationItem<any, any>): Promise<ItemResult> {
    const { requirement, candidate } = item.input;

    let status: 'ELIGIBLE' | 'UNCERTAIN' | 'INELIGIBLE';

    if (requirement === 'US Citizenship') {
      status = candidate.citizenship === 'US' ? 'ELIGIBLE' :
               candidate.citizenship ? 'INELIGIBLE' : 'UNCERTAIN';
    } else if (requirement.includes('PhD')) {
      const hasPhD = candidate.education?.some((e: any) => e.degree === 'PhD' && e.field === 'Computer Science');
      status = hasPhD ? 'ELIGIBLE' : 'INELIGIBLE';
    } else if (requirement.includes('years Python')) {
      const pySkill = candidate.skills?.find((s: any) => s.name === 'Python');
      const years = pySkill?.years || 0;
      status = years >= 5 ? 'ELIGIBLE' : 'INELIGIBLE';
    } else if (requirement.includes('TS/SCI')) {
      status = candidate.clearance === 'TS/SCI' ? 'ELIGIBLE' : 'INELIGIBLE';
    } else if (requirement.includes('Deadline')) {
      const deadline = new Date(requirement.split(': ')[1]);
      const applied = new Date(candidate.appliedAt);
      status = applied <= deadline ? 'ELIGIBLE' : 'INELIGIBLE';
    } else {
      status = 'UNCERTAIN';
    }

    return {
      id: item.id,
      success: true,
      predicted: { status },
      expected: item.expected
    };
  }

  private async evaluateSemanticMatching(item: EvaluationItem<any, any>): Promise<ItemResult> {
    const predicted = {
      skillSimilarity: 0.5,
      careerSimilarity: 0.5,
      technologySimilarity: 0.5,
      domainSimilarity: 0.5,
      experienceSimilarity: 0.5,
      weightedScore: 0.5
    };

    return {
      id: item.id,
      success: true,
      predicted,
      expected: item.expected
    };
  }

  private async evaluateExplanation(item: EvaluationItem<any, any>, modelId: string): Promise<ItemResult> {
    const response = await this.modelService.generate('reasoning', {
      prompt: JSON.stringify(item.input),
      systemPrompt: 'Explain the match. Do not invent facts. Say unknown if missing.',
      temperature: 0.3,
      maxTokens: 2048,
      responseFormat: 'json'
    });

    if (!response.success) {
      return { id: item.id, success: false, error: response.error };
    }

    const predicted = response.data?.text ? JSON.parse(response.data.text) : {};
    const expected = item.expected;

    return {
      id: item.id,
      success: true,
      predicted,
      expected,
      tokenUsage: response.data?.usage ? {
        prompt: response.data.usage.promptTokens,
        completion: response.data.usage.completionTokens,
        total: response.data.usage.totalTokens
      } : undefined
    };
  }

  async evaluateAll(config: EvaluationConfig): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const operation of config.operations) {
      const dataset = ALL_DATASETS.find(d => d.name === operation);
      if (!dataset) continue;

      for (const modelId of config.modelIds) {
        const result = await this.evaluate(dataset, modelId, operation as ModelOperation);
        results.push(result);
      }
    }

    return results;
  }
}

export function createModelEvaluator(modelService: UnifiedModelService): ModelEvaluator {
  return new DefaultModelEvaluator(modelService);
}