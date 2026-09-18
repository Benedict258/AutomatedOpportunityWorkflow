export * from './types';
export * from './retry-manager';
export * from './circuit-breaker';
export * from './error-classification';
export * from './observability';

export const reliabilityModuleInfo = {
  name: 'Failure Handling Reliability Observability',
  step: 11,
  version: '1.0.0',
  modules: [
    'types',
    'retry-manager',
    'circuit-breaker',
    'error-classification',
    'observability',
  ],
  dependencies: [],
};
