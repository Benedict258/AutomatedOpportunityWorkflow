export * from './types';
export * from './classifier.interface';
export { DeterministicClassifier } from './deterministic-classifier';
export { LLMClassifierAdapter } from './llm-classifier-adapter';
export { ClassificationEngine } from './classification-engine';
export { RealClassifier, createRealClassifier } from './real-classifier';
export { buildClassificationPrompt, PROMPT_VERSION, getPromptHash, CLASSIFICATION_PROMPT_V1 } from './prompt-v1';
export { TaxonomyMapper, getTaxonomyMapper, loadTaxonomyCategories } from './taxonomy-mapper';

import { ClassificationEngine } from './classification-engine';
import { createRealClassifier } from './real-classifier';

export const createDefaultEngine = () => {
  return new ClassificationEngine();
};

export const createRealEngine = () => {
  const engine = new ClassificationEngine({
    llmClassifier: createRealClassifier()
  });
  return engine;
};
