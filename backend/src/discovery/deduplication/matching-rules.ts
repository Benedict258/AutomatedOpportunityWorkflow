import { DuplicateCandidate, MatchingRule } from './types';

const normalizeForCompare = (s?: string): string => {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
};

const similarityRatio = (a: string, b: string): number => {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
};

const jaccardSimilarity = (a: string, b: string): number => {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
};

export const exactExternalIdRule: MatchingRule = {
  id: 'exact_external_id',
  name: 'Exact External ID Match',
  weight: 1.0,
  description: 'Same externalId across sources indicates duplicate',
  evaluate: (a, b) => {
    if (a.externalId && b.externalId && a.externalId === b.externalId && a.externalId !== '') {
      return 1.0;
    }
    return 0;
  },
};

export const urlMatchRule: MatchingRule = {
  id: 'url_match',
  name: 'URL Match',
  weight: 0.95,
  description: 'Normalized URL equality',
  evaluate: (a, b) => {
    const urlA = normalizeForCompare(a.normalizedUrl);
    const urlB = normalizeForCompare(b.normalizedUrl);
    if (!urlA || !urlB) return 0;
    return urlA === urlB ? 1.0 : 0;
  },
};

export const titleOrgSimilarityRule: MatchingRule = {
  id: 'title_org_similarity',
  name: 'Title + Organization Similarity',
  weight: 0.7,
  description: 'Combined title and organization fuzzy match',
  evaluate: (a, b) => {
    const titleSim = similarityRatio(a.normalizedTitle, b.normalizedTitle);
    const orgSim = similarityRatio(a.normalizedOrg, b.normalizedOrg);
    
    if (titleSim < 0.7) return 0;
    
    const combined = (titleSim * 0.7 + orgSim * 0.3);
    return combined >= 0.75 ? combined : 0;
  },
};

export const contentFuzzyMatchRule: MatchingRule = {
  id: 'content_fuzzy_match',
  name: 'Content Fuzzy Match',
  weight: 0.6,
  description: 'Description hash and title/org overlap',
  evaluate: (a, b) => {
    if (a.descriptionHash && b.descriptionHash && a.descriptionHash === b.descriptionHash) {
      return 1.0;
    }
    const titleJaccard = jaccardSimilarity(a.normalizedTitle, b.normalizedTitle);
    const orgJaccard = jaccardSimilarity(a.normalizedOrg, b.normalizedOrg);
    
    const score = titleJaccard * 0.6 + orgJaccard * 0.4;
    return score >= 0.8 ? score : 0;
  },
};

export const fingerprintExactRule: MatchingRule = {
  id: 'fingerprint_exact',
  name: 'Fingerprint Exact Match',
  weight: 0.9,
  description: 'Deterministic fingerprint collision',
  evaluate: (a, b) => {
    return a.fingerprint === b.fingerprint ? 1.0 : 0;
  },
};

export const defaultMatchingRules: MatchingRule[] = [
  exactExternalIdRule,
  urlMatchRule,
  fingerprintExactRule,
  titleOrgSimilarityRule,
  contentFuzzyMatchRule,
];

export const getMatchingRules = (customRules?: MatchingRule[]): MatchingRule[] => {
  return customRules && customRules.length > 0 ? customRules : defaultMatchingRules;
};
