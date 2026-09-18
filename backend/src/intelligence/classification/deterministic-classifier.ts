import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Classifier } from './classifier.interface';
import { ClassificationResult, ClassificationContext, ClassifyOptions, CategoryNode, ClassificationConfidenceLevel } from './types';

const TAXONOMY_ROOT = join(process.cwd(), 'taxonomy');

function parseYamlNodes(content: string): CategoryNode[] {
  const nodes: CategoryNode[] = [];
  const lines = content.split(/\r?\n/);
  let current: Partial<CategoryNode> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nodeStart = line.match(/^\s*-\s*id:\s*(.+)$/);
    if (nodeStart) {
      if (current && current.id) {
        nodes.push(current as CategoryNode);
      }
      current = { id: nodeStart[1].trim() };
      continue;
    }
    if (current) {
      const fieldMatch = line.match(/^\s{4,}(\w+):\s*(.+)$/);
      if (fieldMatch) {
        const key = fieldMatch[1];
        let value = fieldMatch[2].trim();
        // Strip surrounding quotes
        value = value.replace(/^['"]|['"]$/g, '');
        // Handle null
        if (value === 'null') value = '';
        // Handle arrays like [a, b]
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1);
        }
        switch (key) {
          case 'id':
            current.id = value;
            break;
          case 'name':
            current.name = value;
            break;
          case 'parent':
            current.parent = value === '' ? null : value;
            break;
          case 'description':
            current.description = value;
            break;
          case 'active':
            current.active = value === 'true';
            break;
          case 'aliases':
            current.aliases = parseList(value);
            break;
          case 'keywords':
            current.keywords = parseList(value);
            break;
          case 'related_to':
            current.relatedTo = parseList(value);
            break;
        }
      }
    }
  }
  if (current && current.id) {
    nodes.push(current as CategoryNode);
  }
  return nodes;
}

function parseList(value: string): string[] {
  if (!value) return [];
  // Support comma-separated or YAML list style already handled
  return value.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

function loadTaxonomy(): Map<string, CategoryNode> {
  const map = new Map<string, CategoryNode>();
  const files = readdirSync(TAXONOMY_ROOT).filter(f => f.endsWith('.yaml'));
  for (const file of files) {
    const fullPath = join(TAXONOMY_ROOT, file);
    const content = readFileSync(fullPath, 'utf8');
    const nodes = parseYamlNodes(content);
    for (const node of nodes) {
      if (!node.active && node.active !== undefined) continue;
      const existing = map.get(node.id);
      if (existing) {
        // Merge
        Object.assign(existing, node);
      } else {
        map.set(node.id, { ...node, active: node.active ?? true } as CategoryNode);
      }
    }
  }
  // Build children
  for (const node of map.values()) {
    if (node.parent && map.has(node.parent)) {
      const parent = map.get(node.parent)!;
      parent.children ??= [];
      if (!parent.children.find(c => c.id === node.id)) {
        parent.children.push(node);
      }
    }
  }
  return map;
}

function buildTermIndex(nodes: Map<string, CategoryNode>) {
  const index = new Map<string, Set<string>>();
  for (const [id, node] of nodes) {
    const terms = new Set<string>();
    if (node.name) terms.add(node.name.toLowerCase());
    if (node.id) terms.add(node.id.toLowerCase());
    if (node.aliases) node.aliases.forEach(a => terms.add(a.toLowerCase()));
    if (node.keywords) node.keywords.forEach(k => terms.add(k.toLowerCase()));
    // Add parent chain terms for hierarchical boost
    let current = node;
    while (current.parent && nodes.has(current.parent)) {
      current = nodes.get(current.parent)!;
      if (current.name) terms.add(current.name.toLowerCase());
      if (current.id) terms.add(current.id.toLowerCase());
    }
    for (const term of terms) {
      if (!index.has(term)) index.set(term, new Set());
      index.get(term)!.add(id);
    }
  }
  return index;
}

export class DeterministicClassifier implements Classifier {
  public readonly name = 'deterministic';
  private nodes: Map<string, CategoryNode>;
  private termIndex: Map<string, Set<string>>;

  constructor() {
    this.nodes = loadTaxonomy();
    this.termIndex = buildTermIndex(this.nodes);
  }

  async isAvailable(): Promise<boolean> {
    return this.nodes.size > 0;
  }

  async classify(text: string, context?: ClassificationContext, options?: ClassifyOptions): Promise<ClassificationResult[]> {
    const topK = options?.topK ?? 5;
    const minConfidence = options?.minConfidence ?? 0.3;
    const includeChildren = options?.includeChildren ?? true;

    const sourceText = [
      context?.title ?? '',
      context?.description ?? '',
      context?.rawText ?? '',
      text,
      ...(context?.tags ?? [])
    ].join(' ').toLowerCase();

    // Simple tokenization
    const tokens = sourceText
      .replace(/[^a-z0-9\s._-]/gi, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);

    const scores = new Map<string, { score: number; matchedTerms: Set<string> }>();

    for (const token of tokens) {
      // Exact term match
      if (this.termIndex.has(token)) {
        for (const id of this.termIndex.get(token)!) {
          this.addScore(scores, id, 1.0, token);
        }
      }
      // Partial match for multi-word terms
      for (const [term, ids] of this.termIndex.entries()) {
        if (term.includes(token) || token.includes(term)) {
          const weight = 0.3;
          for (const id of ids) {
            this.addScore(scores, id, weight, term);
          }
        }
      }
    }

    // Boost for category root names
    const rootCategories = [
      'work', 'technical_experience', 'cybersecurity', 'government',
      'policy', 'international_affairs', 'fellowship', 'education',
      'events', 'news'
    ];
    for (const root of rootCategories) {
      if (sourceText.includes(root.replace(/_/g, ' '))) {
        this.addScore(scores, root, 0.5, root);
      }
    }

    const results: ClassificationResult[] = [];
    for (const [id, { score, matchedTerms }] of scores.entries()) {
      const node = this.nodes.get(id);
      if (!node) continue;
      if (!includeChildren && node.parent && node.parent !== 'opportunity') continue;

      const normalized = Math.min(1, score / 3); // heuristic scaling
      if (normalized < minConfidence) continue;

      const confidenceLevel: ClassificationConfidenceLevel =
        normalized >= 0.7 ? 'high' : normalized >= 0.4 ? 'medium' : 'low';

      const path = this.buildPath(id);

      results.push({
        categoryId: id,
        categoryName: node.name,
        confidence: {
          score: Number(normalized.toFixed(3)),
          level: confidenceLevel,
          reasoning: `Matched terms: ${Array.from(matchedTerms).slice(0,5).join(', ')}`
        },
        source: 'deterministic',
        path,
        matchedTerms: Array.from(matchedTerms),
        metadata: { node }
      });
    }

    results.sort((a, b) => b.confidence.score - a.confidence.score);
    return results.slice(0, topK);
  }

  private addScore(
    scores: Map<string, { score: number; matchedTerms: Set<string> }>,
    id: string,
    weight: number,
    term: string
  ) {
    const existing = scores.get(id);
    if (existing) {
      existing.score += weight;
      existing.matchedTerms.add(term);
    } else {
      scores.set(id, { score: weight, matchedTerms: new Set([term]) });
    }
  }

  private buildPath(id: string): string[] {
    const path: string[] = [];
    let currentId = id;
    while (currentId && this.nodes.has(currentId)) {
      const node = this.nodes.get(currentId)!;
      path.unshift(node.name);
      if (!node.parent) break;
      currentId = node.parent;
    }
    return path;
  }
}
