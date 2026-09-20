import { SemanticMatcher } from './semantic-matcher.interface';
import { SemanticMatchResult, SemanticFactor } from './types';
import { PgEmbeddingRepository } from '../../persistence/pg-embedding-repository';

export class SemanticMatchingEngine implements SemanticMatcher {
  private embeddingRepo = new PgEmbeddingRepository();

  /** High‑level API used by the rest of the system – IDs only */
  async match(candidateId: string, opportunityId: string): Promise<SemanticMatchResult> {
    // Fetch minimal profile data required for deterministic factors.
    // In a real codebase this would come from Candidate/Opportunity repositories.
    const candidate = await this.fetchCandidateProfile(candidateId);
    const opportunity = await this.fetchOpportunityProfile(opportunityId);

    if (!candidate || !opportunity) {
      return this.emptyResult(candidateId, opportunityId);
    }

    return this.computeMatch(candidate, opportunity);
  }

  /** Deterministic, pure‑function implementation used by tests and the ID‑based API */
  async computeMatch(
    candidate: CandidateProfile,
    opportunity: OpportunityProfile
  ): Promise<SemanticMatchResult> {
    // ---------- 1️⃣ Skill similarity ----------
    let skillScore = 0;
    let skillConf = 0;
    let skillEvid: string[] = [];

    if (candidate.skillEmbedding && opportunity.skillEmbedding) {
      const cos = this.cosineSimilarity(candidate.skillEmbedding, opportunity.skillEmbedding);
      skillScore = this.clamp(cos);
      skillConf = 0.9;
      skillEvid = [`cosine=${cos.toFixed(3)}`];
    } else if (candidate.skills?.length && opportunity.requiredSkills?.length) {
      const jac = this.jaccard(candidate.skills, opportunity.requiredSkills);
      skillScore = jac;
      skillConf = 0.7;
      skillEvid = [`jaccard=${jac.toFixed(3)}`];
    }

    // ---------- 2️⃣ Career / title similarity ----------
    let careerScore = 0;
    let careerConf = 0;
    let careerEvid: string[] = [];

    if (candidate.careerEmbedding && opportunity.careerEmbedding) {
      const cos = this.cosineSimilarity(candidate.careerEmbedding, opportunity.careerEmbedding);
      careerScore = this.clamp(cos);
      careerConf = 0.9;
      careerEvid = [`cosine=${cos.toFixed(3)}`];
    } else if (candidate.currentTitle && opportunity.title) {
      const lev = this.levenshteinNormalized(candidate.currentTitle, opportunity.title);
      careerScore = lev;
      careerConf = 0.6;
      careerEvid = [`levenshtein=${lev.toFixed(3)}`];
    }

    // ---------- 3️⃣ Technology similarity ----------
    const techScore = this.jaccard(
      candidate.technologies ?? [],
      opportunity.technologies ?? []
    );
    const techConf = candidate.technologies?.length && opportunity.technologies?.length ? 0.8 : 0.4;
    const techEvid = [`jaccard=${techScore.toFixed(3)}`];

    // ---------- 4️⃣ Domain similarity ----------
    let domainScore = 0;
    let domainConf = 0;
    let domainEvid: string[] = [];

    if (candidate.domainEmbedding && opportunity.domainEmbedding) {
      const cos = this.cosineSimilarity(candidate.domainEmbedding, opportunity.domainEmbedding);
      domainScore = this.clamp(cos);
      domainConf = 0.9;
      domainEvid = [`cosine=${cos.toFixed(3)}`];
    } else if (candidate.domain && opportunity.domain) {
      const lev = this.levenshteinNormalized(candidate.domain, opportunity.domain);
      domainScore = lev;
      domainConf = 0.6;
      domainEvid = [`levenshtein=${lev.toFixed(3)}`];
    }

    // ---------- 5️⃣ Experience similarity ----------
    const candExp = candidate.yearsOfExperience ?? 0;
    const reqExp = opportunity.requiredExperienceYears ?? 0;
    const expDiff = Math.abs(candExp - reqExp);
    const maxExp = Math.max(candExp, reqExp, 1);
    const expScore = 1 - expDiff / maxExp;
    const expConf = 0.85;
    const expEvid = [`candidateYears=${candExp}`, `requiredYears=${reqExp}`, `diff=${expDiff}`];

    // ---------- 6️⃣ Role similarity ----------
    const roleScore = this.levenshteinNormalized(
      candidate.currentTitle ?? '',
      opportunity.title ?? ''
    );
    const roleConf = 0.7;
    const roleEvid = [`levenshtein=${roleScore.toFixed(3)}`];

    // ---------- Overall ----------
    const factors = [
      skillScore,
      careerScore,
      techScore,
      domainScore,
      expScore,
      roleScore,
    ];
    const overall = factors.reduce((a, b) => a + b, 0) / factors.length;

    return {
      opportunityId: opportunity.id,
      candidateId: candidate.id,
      skillSimilarity: { name: 'skillSimilarity', score: skillScore, confidence: skillConf, evidence: skillEvid },
      careerSimilarity: { name: 'careerSimilarity', score: careerScore, confidence: careerConf, evidence: careerEvid },
      technologySimilarity: { name: 'technologySimilarity', score: techScore, confidence: techConf, evidence: techEvid },
      domainSimilarity: { name: 'domainSimilarity', score: domainScore, confidence: domainConf, evidence: domainEvid },
      experienceSimilarity: { name: 'experienceSimilarity', score: expScore, confidence: expConf, evidence: expEvid },
      roleSimilarity: { name: 'roleSimilarity', score: roleScore, confidence: roleConf, evidence: roleEvid },
      overall: this.clamp(overall),
    };
  }

  /* ------------------------------------------------------------------ */
  /* -------------------------- Helpers --------------------------------- */
  /* ------------------------------------------------------------------ */

  private emptyResult(candidateId: string, opportunityId: string): SemanticMatchResult {
    const empty = (name: string): SemanticFactor => ({ name, score: 0, confidence: 0, evidence: [] });
    return {
      opportunityId,
      candidateId,
      skillSimilarity: empty('skillSimilarity'),
      careerSimilarity: empty('careerSimilarity'),
      technologySimilarity: empty('technologySimilarity'),
      domainSimilarity: empty('domainSimilarity'),
      experienceSimilarity: empty('experienceSimilarity'),
      roleSimilarity: empty('roleSimilarity'),
      overall: 0,
    };
  }

  private clamp(v: number): number {
    return Math.max(0, Math.min(1, v));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  private jaccard<T>(a: T[], b: T[]): number {
    if (!a.length && !b.length) return 1;
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    const inter = [...setA].filter(x => setB.has(x)).length;
    const union = setA.size + setB.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  private levenshteinNormalized(s1: string, s2: string): number {
    if (!s1 && !s2) return 1;
    if (!s1 || !s2) return 0;
    const a = s1.toLowerCase();
    const b = s2.toLowerCase();
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    const dist = dp[a.length][b.length];
    const maxLen = Math.max(a.length, b.length);
    return 1 - dist / maxLen;
  }

  /* ------------------------------------------------------------------ */
  /* ----------------------- Data fetch stubs -------------------------- */
  /* ------------------------------------------------------------------ */

  /** Replace with real repositories when they exist */
  private async fetchCandidateProfile(id: string): Promise<CandidateProfile | null> {
    // Placeholder – in practice query CandidateRepository + embedding tables
    return null;
  }

  private async fetchOpportunityProfile(id: string): Promise<OpportunityProfile | null> {
    // Placeholder – in practice query OpportunityRepository + embedding tables
    return null;
  }
}

/* ---------------------------------------------------------------------- */
/* --------------------------- Types used locally ----------------------- */
/* ---------------------------------------------------------------------- */

interface CandidateProfile {
  id: string;
  skills?: string[];
  skillEmbedding?: number[];
  careerEmbedding?: number[];
  currentTitle?: string;
  technologies?: string[];
  domain?: string;
  domainEmbedding?: number[];
  yearsOfExperience?: number;
}

interface OpportunityProfile {
  id: string;
  requiredSkills?: string[];
  skillEmbedding?: number[];
  careerEmbedding?: number[];
  title?: string;
  technologies?: string[];
  domain?: string;
  domainEmbedding?: number[];
  requiredExperienceYears?: number;
}

export const realMatchingEngine = new SemanticMatchingEngine();
