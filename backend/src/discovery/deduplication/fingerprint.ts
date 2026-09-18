import crypto from 'crypto';
import { NormalizedOpportunity } from '../normalization/types';
import { DuplicateCandidate } from './types';

const normalizeString = (value?: string): string => {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

const hashString = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
};

export const normalizeOpportunityFields = (opp: NormalizedOpportunity) => {
  const normalizedTitle = normalizeString(opp.title);
  const normalizedOrg = normalizeString(opp.organization ?? '');
  const normalizedUrl = normalizeString(opp.url ?? opp.applicationUrl ?? '');
  const description = (opp.description ?? '').replace(/\s+/g, ' ').trim();
  const descriptionHash = description ? hashString(description.toLowerCase()) : '';
  
  return {
    normalizedTitle,
    normalizedOrg,
    normalizedUrl,
    descriptionHash,
    descriptionHashFull: description ? hashString(description) : '',
  };
};

export const generateFingerprint = (opp: NormalizedOpportunity): string => {
  const { normalizedTitle, normalizedOrg, normalizedUrl } = normalizeOpportunityFields(opp);
  const components = [
    normalizedTitle,
    normalizedOrg,
    normalizedUrl,
  ].filter(Boolean);
  
  const raw = components.join('|');
  return hashString(raw);
};

export const fingerprintCandidate = (opp: NormalizedOpportunity, source: string): DuplicateCandidate => {
  const { normalizedTitle, normalizedOrg, normalizedUrl, descriptionHash } = normalizeOpportunityFields(opp);
  const fingerprint = generateFingerprint(opp);
  
  return {
    opportunity: opp,
    fingerprint,
    source,
    externalId: opp.externalId,
    normalizedTitle,
    normalizedOrg,
    normalizedUrl,
    descriptionHash,
  };
};

export const batchFingerprint = (opportunities: NormalizedOpportunity[], source: string): DuplicateCandidate[] => {
  return opportunities.map(opp => fingerprintCandidate(opp, source));
};
