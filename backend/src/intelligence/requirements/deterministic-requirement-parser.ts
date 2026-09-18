import { Requirement, RequirementType, RequirementRelationship, RequirementConfidence, RequirementProvenance, RequirementExtractionResult } from './types';

type SignalRule = {
  relationship: RequirementRelationship;
  regex: RegExp;
  confidence: RequirementConfidence;
};

const RELATIONSHIP_SIGNALS: SignalRule[] = [
  // REQUIRED
  { relationship: RequirementRelationship.REQUIRED, regex: /\b(must have|required|mandatory|need|essential|minimum requirement|prerequisite)\b/i, confidence: RequirementConfidence.HIGH },
  { relationship: RequirementRelationship.REQUIRED, regex: /\brequired:\s*(.+)/i, confidence: RequirementConfidence.HIGH },
  { relationship: RequirementRelationship.REQUIRED, regex: /\b(at least|minimum of)\b.{0,80}\b(years? experience|degree|certification)\b/i, confidence: RequirementConfidence.MEDIUM },
  // PREFERRED
  { relationship: RequirementRelationship.PREFERRED, regex: /\b(preferred|nice to have|plus|bonus|advantage|desired|would be a plus)\b/i, confidence: RequirementConfidence.HIGH },
  { relationship: RequirementRelationship.PREFERRED, regex: /\bnice to have\s*[:\-]\s*(.+)/i, confidence: RequirementConfidence.HIGH },
  // OPTIONAL
  { relationship: RequirementRelationship.OPTIONAL, regex: /\b(optional|not required|if available)\b/i, confidence: RequirementConfidence.HIGH },
  // INFERRED
  { relationship: RequirementRelationship.INFERRED, regex: /\b(familiar with|exposure to|some experience with)\b/i, confidence: RequirementConfidence.LOW },
];

const TYPE_KEYWORDS: Record<RequirementType, RegExp[]> = {
  [RequirementType.SKILL]: [
    /\b(proficient in|skilled in|expertise in|experience with|knowledge of)\s+([A-Za-z0-9+\-.# ]{2,60})/i,
  ],
  [RequirementType.TECHNOLOGY]: [
    /\b(using|with|on|in)\s+([A-Za-z0-9+\-.# ]{2,60})\s*(?:and|or|,)/i,
  ],
  [RequirementType.CERTIFICATION]: [
    /\b(certified|certification|certificate)\s*(?:in|of)?\s*([A-Za-z0-9 ]{2,60})/i,
    /\b(AWS Certified|PMP|CISSP|GCP|Azure Certified)\b/i,
  ],
  [RequirementType.EDUCATION]: [
    /\b(bachelor|master|phd|degree|b\.s\.|m\.s\.|bachelor's|master's)\s+(?:in|of)?\s*([A-Za-z ]{2,60})/i,
    /\b(degree in|education:)\s*([A-Za-z ]+)/i,
  ],
  [RequirementType.EXPERIENCE]: [
    /\b(\d+\+?\s*years?\s+experience\s+(?:in|with)?\s*([A-Za-z ]+))/i,
    /\b(\d+\s*-\s*\d+\s*years?\s+experience)/i,
  ],
  [RequirementType.LOCATION]: [
    /\b(location|based in|work location)\s*[:\-]\s*([A-Za-z ,]+)/i,
    /\b(remote|on-site|hybrid)\b/i,
  ],
  [RequirementType.CITIZENSHIP]: [
    /\b(citizenship|citizen of)\s*[:\-]\s*([A-Za-z ]+)/i,
    /\b(U\.S\. citizen|U\.S citizen|EU citizen)\b/i,
  ],
  [RequirementType.WORK_AUTHORIZATION]: [
    /\b(work authorization|sponsorship|visa)\s*[:\-]\s*([A-Za-z ]+)/i,
    /\b(work authorization required|visa sponsorship)\b/i,
  ],
  [RequirementType.CLEARANCE]: [
    /\b(security clearance|clearance)\s*[:\-]\s*([A-Za-z ]+)/i,
    /\b(secret clearance|top secret|public trust)\b/i,
  ],
  [RequirementType.LANGUAGE]: [
    /\b(language|fluent in|speaks)\s*[:\-]\s*([A-Za-z ]+)/i,
    /\b(English|Spanish|Mandarin|French)\s+(?:required|preferred|fluent)/i,
  ],
};

function normalizeValue(type: RequirementType, raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

function findRelationship(text: string, snippetStart: number, snippetEnd: number): { relationship: RequirementRelationship; confidence: RequirementConfidence } {
  const contextWindow = 200;
  const start = Math.max(0, snippetStart - contextWindow);
  const end = Math.min(text.length, snippetEnd + contextWindow);
  const context = text.slice(start, end);

  for (const rule of RELATIONSHIP_SIGNALS) {
    if (rule.regex.test(context)) {
      return { relationship: rule.relationship, confidence: rule.confidence };
    }
  }

  // Section heuristics
  if (/requirements|qualifications|must have/i.test(context)) {
    return { relationship: RequirementRelationship.REQUIRED, confidence: RequirementConfidence.MEDIUM };
  }
  if (/preferred|nice to have/i.test(context)) {
    return { relationship: RequirementRelationship.PREFERRED, confidence: RequirementConfidence.MEDIUM };
  }

  return { relationship: RequirementRelationship.UNKNOWN, confidence: RequirementConfidence.LOW };
}

function extractMatches(text: string, type: RequirementType): { value: string; start: number; end: number }[] {
  const results: { value: string; start: number; end: number }[] = [];
  const patterns = TYPE_KEYWORDS[type] ?? [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    while ((match = globalPattern.exec(text)) !== null) {
      const candidate = match[2] || match[1] || match[0];
      if (!candidate || candidate.length < 2 || candidate.length > 120) {
        globalPattern.lastIndex++;
        continue;
      }
      // Filter generic noise
      if (/^\s*$/.test(candidate) || /^(and|or|the|with)$/i.test(candidate)) {
        continue;
      }
      results.push({
        value: candidate.trim(),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return results;
}

export class DeterministicRequirementParser {
  parse(text: string, sourceId: string, section?: string): Requirement[] {
    const requirements: Requirement[] = [];
    const seen = new Set<string>();

    for (const type of Object.values(RequirementType)) {
      const matches = extractMatches(text, type);
      for (const m of matches) {
        const normalized = normalizeValue(type, m.value);
        const key = `${type}:${normalized}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const { relationship, confidence } = findRelationship(text, m.start, m.end);
        const snippet = text.slice(Math.max(0, m.start - 80), Math.min(text.length, m.end + 80)).replace(/\s+/g, ' ').trim();

        const req: Requirement = {
          id: `${sourceId}-${type}-${Math.abs(normalized.split('').reduce((a, c) => a + c.charCodeAt(0), 0))}-${m.start}`,
          type,
          value: m.value.trim(),
          normalizedValue: normalized,
          relationship,
          confidence,
          provenance: [{
            source: sourceId,
            section,
            snippet,
            startIndex: m.start,
            endIndex: m.end,
          }],
          extractedAt: new Date().toISOString(),
        };
        requirements.push(req);
      }
    }

    // Additional heuristic for bullet lists
    const bulletRegex = /^\s*[-•*]\s*(.+)$/gm;
    let bulletMatch: RegExpExecArray | null;
    while ((bulletMatch = bulletRegex.exec(text)) !== null) {
      const line = bulletMatch[1];
      const lower = line.toLowerCase();
      let type = RequirementType.SKILL;
      if (/certif/i.test(lower)) type = RequirementType.CERTIFICATION;
      else if (/degree|bachelor|master|phd/i.test(lower)) type = RequirementType.EDUCATION;
      else if (/year/i.test(lower)) type = RequirementType.EXPERIENCE;
      else if (/location|remote|on-site/i.test(lower)) type = RequirementType.LOCATION;
      else if (/citizen|passport/i.test(lower)) type = RequirementType.CITIZENSHIP;
      else if (/visa|sponsorship|work authorization/i.test(lower)) type = RequirementType.WORK_AUTHORIZATION;
      else if (/clearance|security/i.test(lower)) type = RequirementType.CLEARANCE;
      else if (/language|fluent|speaks/i.test(lower)) type = RequirementType.LANGUAGE;

      const { relationship, confidence } = findRelationship(text, bulletMatch.index, bulletMatch.index + line.length);
      const normalized = normalizeValue(type, line);
      const key = `${type}:${normalized}`;
      if (seen.has(key)) continue;
      seen.add(key);

      requirements.push({
        id: `${sourceId}-${type}-${bulletMatch.index}`,
        type,
        value: line.trim(),
        normalizedValue: normalized,
        relationship,
        confidence,
        provenance: [{
          source: sourceId,
          section,
          snippet: line.trim(),
          startIndex: bulletMatch.index,
          endIndex: bulletMatch.index + line.length,
        }],
        extractedAt: new Date().toISOString(),
        metadata: { heuristic: 'bullet' },
      });
    }

    return requirements;
  }

  parseSections(sections: Record<string, string>, sourceId: string): Requirement[] {
    const all: Requirement[] = [];
    for (const [section, content] of Object.entries(sections)) {
      const parsed = this.parse(content, sourceId, section);
      all.push(...parsed);
    }
    return all;
  }
}
