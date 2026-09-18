export * from './types';
export * from './classifier.interface';
export { DeterministicClassifier } from './deterministic-classifier';
export { LLMClassifierAdapter } from './llm-classifier-adapter';
export { ClassificationEngine } from './classification-engine';

export const createDefaultEngine = () => {
  return new ClassificationEngine();
};
