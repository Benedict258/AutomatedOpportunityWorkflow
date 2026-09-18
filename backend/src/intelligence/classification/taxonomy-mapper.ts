import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { CategoryNode } from './types';

const TAXONOMY_ROOT = join(process.cwd(), 'taxonomy');

/**
 * Parsed taxonomy node from YAML
 */
interface RawTaxonomyNode {
  id: string;
  name: string;
  parent: string | null;
  description?: string;
  active?: boolean;
  aliases?: string[];
  keywords?: string[];
  relatedTo?: string[];
}

/**
 * Parse YAML content into raw taxonomy nodes
 */
function parseYamlNodes(content: string): RawTaxonomyNode[] {
  const nodes: RawTaxonomyNode[] = [];
  const lines = content.split(/\r?\n/);
  let current: Partial<RawTaxonomyNode> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nodeStart = line.match(/^\s*-\s*id:\s*(.+)$/);
    if (nodeStart) {
      if (current && current.id) {
        nodes.push(current as RawTaxonomyNode);
      }
      current = { id: nodeStart[1].trim() };
      continue;
    }
    if (current) {
      const fieldMatch = line.match(/^\s{4,}(\w+):\s*(.+)$/);
      if (fieldMatch) {
        const key = fieldMatch[1];
        let value = fieldMatch[2].trim();
        value = value.replace(/^['"]|['"]$/g, '');
        if (value === 'null') value = '';
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
    nodes.push(current as RawTaxonomyNode);
  }
  return nodes;
}

function parseList(value: string): string[] {
  if (!value) return [];
  return value.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/**
 * Load all taxonomy categories from YAML files
 */
export function loadTaxonomyCategories(): Map<string, CategoryNode> {
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
        Object.assign(existing, node);
      } else {
        map.set(node.id, { 
          ...node, 
          active: node.active ?? true,
          parent: node.parent === '' ? null : node.parent
        } as CategoryNode);
      }
    }
  }
  
  // Build children hierarchy
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

/**
 * Taxonomy Mapper - Maps model output to validated taxonomy IDs
 */
export class TaxonomyMapper {
  private categories: Map<string, CategoryNode>;
  private idToName: Map<string, string>;
  private nameToId: Map<string, string>;
  private aliasToId: Map<string, string>;

  constructor() {
    this.categories = loadTaxonomyCategories();
    this.idToName = new Map();
    this.nameToId = new Map();
    this.aliasToId = new Map();
    this.buildIndexes();
  }

  private buildIndexes(): void {
    for (const [id, node] of this.categories) {
      this.idToName.set(id, node.name);
      this.nameToId.set(node.name.toLowerCase(), id);
      if (node.aliases) {
        for (const alias of node.aliases) {
          this.aliasToId.set(alias.toLowerCase(), id);
        }
      }
    }
  }

  /**
   * Validate and map a model-provided category ID to a taxonomy category
   * Returns the validated category ID or null if not found
   */
  mapCategoryId(modelCategoryId: string): string | null {
    // Direct ID match
    if (this.categories.has(modelCategoryId)) {
      return modelCategoryId;
    }

    // Try case-insensitive ID match
    const lowerId = modelCategoryId.toLowerCase();
    for (const [id] of this.categories) {
      if (id.toLowerCase() === lowerId) {
        return id;
      }
    }

    // Try name match
    const nameMatch = this.nameToId.get(modelCategoryId.toLowerCase());
    if (nameMatch) return nameMatch;

    // Try alias match
    const aliasMatch = this.aliasToId.get(modelCategoryId.toLowerCase());
    if (aliasMatch) return aliasMatch;

    // Try partial match (e.g., "internship" -> "work.internship")
    for (const [id] of this.categories) {
      if (id.toLowerCase().endsWith('.' + lowerId) || 
          id.toLowerCase().includes('.' + lowerId + '.')) {
        return id;
      }
    }

    return null;
  }

  /**
   * Get the full path (names) for a category ID
   */
  getPath(categoryId: string): string[] {
    const path: string[] = [];
    let currentId = categoryId;
    
    while (currentId && this.categories.has(currentId)) {
      const node = this.categories.get(currentId)!;
      path.unshift(node.name);
      if (!node.parent) break;
      currentId = node.parent;
    }
    
    return path;
  }

  /**
   * Get category name by ID
   */
  getCategoryName(categoryId: string): string | undefined {
    return this.idToName.get(categoryId);
  }

  /**
   * Get category node by ID
   */
  getCategory(categoryId: string): CategoryNode | undefined {
    return this.categories.get(categoryId);
  }

  /**
   * Check if a category ID exists in taxonomy
   */
  hasCategory(categoryId: string): boolean {
    return this.categories.has(categoryId);
  }

  /**
   * Get all valid category IDs
   */
  getAllCategoryIds(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get all root-level category IDs (children of 'opportunity')
   */
  getRootCategoryIds(): string[] {
    return Array.from(this.categories.values())
      .filter(n => n.parent === 'opportunity' || n.parent === null)
      .map(n => n.id);
  }

  /**
   * Get child category IDs for a parent
   */
  getChildCategoryIds(parentId: string): string[] {
    const parent = this.categories.get(parentId);
    if (!parent?.children) return [];
    return parent.children.map(c => c.id);
  }

  /**
   * Validate an array of model classification results
   * Returns only valid, taxonomy-conformant results
   */
  validateResults(results: Array<{
    categoryId: string;
    confidenceScore: number;
    reasoning: string;
  }>): Array<{
    categoryId: string;
    categoryName: string;
    confidenceScore: number;
    reasoning: string;
    path: string[];
  }> {
    const validated: Array<{
      categoryId: string;
      categoryName: string;
      confidenceScore: number;
      reasoning: string;
      path: string[];
    }> = [];

    for (const result of results) {
      const mappedId = this.mapCategoryId(result.categoryId);
      if (!mappedId) continue;

      const categoryName = this.getCategoryName(mappedId) || result.categoryId;
      const path = this.getPath(mappedId);

      validated.push({
        categoryId: mappedId,
        categoryName,
        confidenceScore: Math.max(0, Math.min(1, result.confidenceScore)),
        reasoning: result.reasoning || '',
        path
      });
    }

    return validated;
  }
}

// Singleton instance
let _mapperInstance: TaxonomyMapper | null = null;

export function getTaxonomyMapper(): TaxonomyMapper {
  if (!_mapperInstance) {
    _mapperInstance = new TaxonomyMapper();
  }
  return _mapperInstance;
}