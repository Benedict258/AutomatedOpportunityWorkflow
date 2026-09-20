import { UnifiedModelService } from 'shared/models/unified-service';
import { DefaultModelEvaluator, createModelEvaluator } from './evaluator';
import { EvaluationConfig } from './types';
import { ALL_DATASETS } from './dataset';

export class EvaluationRunner {
  private modelService: UnifiedModelService;
  private evaluator: DefaultModelEvaluator;

  constructor(modelService: UnifiedModelService) {
    this.modelService = modelService;
    this.evaluator = createModelEvaluator(modelService) as DefaultModelEvaluator;
  }

  async run(config: EvaluationConfig): Promise<void> {
    console.log('Starting evaluation...');
    console.log(`Datasets: ${config.operations.join(', ')}`);
    console.log(`Models: ${config.modelIds.join(', ')}`);

    const results = await this.evaluator.evaluateAll(config);

    console.log('\n=== EVALUATION RESULTS ===');
    for (const result of results) {
      console.log(`\nDataset: ${result.datasetName}`);
      console.log(`Model: ${result.modelId}`);
      console.log(`Run: ${result.runId}`);
      console.log(`  Accuracy: ${(result.metrics.accuracy || 0).toFixed(3)}`);
      console.log(`  Precision: ${(result.metrics.precision || 0).toFixed(3)}`);
      console.log(`  Recall: ${(result.metrics.recall || 0).toFixed(3)}`);
      console.log(`  F1: ${(result.metrics.f1 || 0).toFixed(3)}`);
      console.log(`  Schema Validity: ${(result.metrics.schemaValidity || 0).toFixed(3)}`);
      console.log(`  Grounding: ${(result.metrics.groundingScore || 0).toFixed(3)}`);
      console.log(`  Hallucination Rate: ${(result.metrics.hallucinationRate || 0).toFixed(3)}`);
      console.log(`  Avg Latency: ${(result.metrics.avgLatencyMs || 0).toFixed(0)}ms`);
      console.log(`  Avg Tokens: ${(result.metrics.avgTokens || 0).toFixed(0)}`);
      console.log(`  Fallback Rate: ${(result.metrics.fallbackRate || 0).toFixed(3)}`);
      console.log(`  Error Rate: ${(result.metrics.errorRate || 0).toFixed(3)}`);

      const passed = result.items.filter(i => i.success).length;
      const failed = result.items.filter(i => !i.success).length;
      console.log(`  Items: ${passed}/${result.items.length} passed, ${failed} failed`);
    }

    console.log('\n=== SUMMARY ===');
    const totalRuns = results.length;
    const avgAccuracy = results.reduce((s, r) => s + (r.metrics.accuracy || 0), 0) / totalRuns;
    console.log(`Average Accuracy: ${avgAccuracy.toFixed(3)}`);
  }
}

export async function runEvaluationFromCLI(): Promise<void> {
  const modelService = new UnifiedModelService();
  await modelService.initialize();

  const config: EvaluationConfig = {
    datasetPath: '',
    modelIds: ['gpt-4o-mini'],
    operations: ['extraction', 'classification', 'requirement-extraction', 'eligibility', 'reasoning'],
    outputDir: './eval-results',
    parallel: false,
    timeoutMs: 60000
  };

  const runner = new EvaluationRunner(modelService);
  await runner.run(config);

  await modelService.shutdown();
}

if (require.main === module) {
  runEvaluationFromCLI().catch(console.error);
}