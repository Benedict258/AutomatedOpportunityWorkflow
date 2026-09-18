export interface IntelligencePipelineInput {
  opportunityId: string;
  candidateId: string;
}

export interface IntelligencePipelineResult {
  opportunityId: string;
  candidateId: string;
  classification: any;
  eligibility: any;
  matchScore: any;
  ranking: any;
  explanation: any;
}

export class IntelligencePipeline {
  async run(input: IntelligencePipelineInput): Promise<IntelligencePipelineResult> {
    return {
      opportunityId: input.opportunityId,
      candidateId: input.candidateId,
      classification: {},
      eligibility: {},
      matchScore: {},
      ranking: {},
      explanation: {},
    };
  }
}
