import { ClassificationResult, ClassificationContext, ClassifyOptions } from './types';

export interface Classifier {
  name: string;
  classify(text: string, context?: ClassificationContext, options?: ClassifyOptions): Promise<ClassificationResult[]>;
  isAvailable(): Promise<boolean>;
}
