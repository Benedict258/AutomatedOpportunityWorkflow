export * from './types';
export * from './profile-derivation';
export * from './candidate-intelligence-builder';
export * from './prompt-v1';
export * from './candidate-embedder';
export * from './real-candidate-intelligence';

// Public API for candidate intelligence module
export {
  buildCandidateIntelligence as build,
  buildCandidateIntelligence,
} from './candidate-intelligence-builder';

export { deriveProfile } from './profile-derivation';

export {
  RealCandidateIntelligenceEngine,
  createRealCandidateIntelligenceEngine,
} from './real-candidate-intelligence';

export {
  CandidateEmbedder,
  buildCandidateEmbeddingText,
  CandidateEmbeddingService,
  createCandidateEmbeddingService,
} from './candidate-embedder';

export {
  buildCandidateIntelligencePrompt,
  CANDIDATE_INTELLIGENCE_JSON_SCHEMA,
  CANDIDATE_INTELLIGENCE_PROMPT_VERSION,
  getCandidateIntelligencePromptHash,
} from './prompt-v1';
