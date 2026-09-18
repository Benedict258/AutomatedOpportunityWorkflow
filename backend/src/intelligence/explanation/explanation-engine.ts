import { Explanation } from './types';

export class ExplanationEngine {
  async explain(intelligence: any): Promise<Explanation> {
    return {
      summary: `Opportunity ${intelligence.opportunityId} relevance summary`,
      matchingStrengths: [],
      eligibilityEvidence: [],
      gaps: [],
      uncertainties: [],
      actionConsiderations: [],
      evidenceReferences: [],
    };
  }
}
