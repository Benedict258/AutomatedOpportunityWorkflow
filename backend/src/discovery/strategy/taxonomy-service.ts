import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface TaxonomyNode {
  id: string;
  name: string;
  parent?: string | null;
  description?: string;
  active?: boolean;
  aliases?: string[];
  keywords?: string[];
  related_to?: string[];
}

export interface TaxonomyFile {
  file: string;
  nodes: TaxonomyNode[];
}

export class TaxonomyService {
  private basePath: string;
  private cache = new Map<string, TaxonomyFile>();

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  loadFile(fileName: string): TaxonomyFile {
    if (this.cache.has(fileName)) {
      return this.cache.get(fileName)!;
    }
    const fullPath = path.join(this.basePath, fileName);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Taxonomy file not found: ${fileName}`);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    const data = yaml.load(content) as any;
    const nodes = (data.nodes ?? []) as TaxonomyNode[];
    const taxonomyFile = { file: fileName, nodes };
    this.cache.set(fileName, taxonomyFile);
    return taxonomyFile;
  }

  getNode(fileName: string, nodeId: string): TaxonomyNode | undefined {
    const file = this.loadFile(fileName);
    return file.nodes.find(n => n.id === nodeId && (n.active ?? true));
  }

  getDescendants(fileName: string, nodeId: string): TaxonomyNode[] {
    const file = this.loadFile(fileName);
    const childrenMap = new Map<string, TaxonomyNode[]>();
    for (const node of file.nodes) {
      const parent = node.parent ?? '';
      if (!childrenMap.has(parent)) childrenMap.set(parent, []);
      childrenMap.get(parent)!.push(node);
    }
    const descendants: TaxonomyNode[] = [];
    const stack = childrenMap.get(nodeId) ?? [];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.active ?? true) descendants.push(node);
      const kids = childrenMap.get(node.id) ?? [];
      stack.push(...kids);
    }
    return descendants;
  }

  getKeywordsForNode(fileName: string, nodeId: string): string[] {
    const node = this.getNode(fileName, nodeId);
    if (!node) return [];
    const keywords = new Set<string>();
    if (node.keywords) node.keywords.forEach(k => keywords.add(k.toLowerCase()));
    if (node.aliases) node.aliases.forEach(a => keywords.add(a.toLowerCase()));
    keywords.add(node.name.toLowerCase());
    keywords.add(node.id.toLowerCase());
    return Array.from(keywords);
  }

  expandTaxonomyRefs(refs: { taxonomyFile: string; nodeId: string }[]): { nodeId: string; keywords: string[] }[] {
    return refs.map(ref => {
      const keywords = this.getKeywordsForNode(ref.taxonomyFile, ref.nodeId);
      const descendants = this.getDescendants(ref.taxonomyFile, ref.nodeId);
      const descendantKeywords = descendants.flatMap(d => this.getKeywordsForNode(ref.taxonomyFile, d.id));
      const allKeywords = Array.from(new Set([...keywords, ...descendantKeywords]));
      return { nodeId: ref.nodeId, keywords: allKeywords };
    });
  }
}
