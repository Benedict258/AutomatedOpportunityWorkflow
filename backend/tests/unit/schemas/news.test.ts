import { describe, it, expect } from 'vitest';
import {
  newsSchema,
  createNewsItemSchema,
  updateNewsItemSchema,
  newsFiltersSchema,
} from '@/schemas/news.js';

describe('News Schemas', () => {
  describe('newsSchema', () => {
    it('should accept valid news item', () => {
      const now = new Date().toISOString();
      const result = newsSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Tech News',
        sourceId: '123e4567-e89b-12d3-a456-426614174001',
        url: 'https://example.com/news',
        summary: 'Summary of news',
        publishedAt: now,
        topic: 'TECHNOLOGY',
        organization: 'Tech Corp',
        sector: 'PRIVATE',
        geography: 'US',
        relevance: 0.85,
        relatedOpportunityIds: ['123e4567-e89b-12d3-a456-426614174002'],
        discoveredAt: now,
        createdAt: now,
        updatedAt: now,
      });
      expect(result.relevance).toBe(0.85);
    });

    it('should reject relevance out of range', () => {
      const now = new Date().toISOString();
      expect(() => newsSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'News',
        sourceId: '123e4567-e89b-12d3-a456-426614174001',
        publishedAt: now,
        discoveredAt: now,
        relevance: 1.5,
      })).toThrow();
      expect(() => newsSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'News',
        sourceId: '123e4567-e89b-12d3-a456-426614174001',
        publishedAt: now,
        discoveredAt: now,
        relevance: -0.1,
      })).toThrow();
    });
  });

  describe('createNewsItemSchema', () => {
    it('should accept valid create request', () => {
      const result = createNewsItemSchema.parse({
        title: 'New Article',
        sourceId: '123e4567-e89b-12d3-a456-426614174001',
        url: 'https://example.com/article',
        summary: 'Summary',
        publishedAt: new Date().toISOString(),
        topic: 'TECHNOLOGY',
        organization: 'Org',
        sector: 'PRIVATE',
        geography: 'US',
        relevance: 0.9,
        relatedOpportunityIds: [],
      });
      expect(result.title).toBe('New Article');
    });
  });

  describe('updateNewsItemSchema', () => {
    it('should accept partial update', () => {
      const result = updateNewsItemSchema.parse({
        title: 'Updated Title',
        relevance: 0.95,
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should accept empty update', () => {
      const result = updateNewsItemSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('newsFiltersSchema', () => {
    it('should accept valid filters', () => {
      const result = newsFiltersSchema.parse({
        topic: 'TECHNOLOGY',
        sourceId: '123e4567-e89b-12d3-a456-426614174001',
        organization: 'Tech Corp',
        sector: 'PRIVATE',
        geography: 'US',
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-12-31T23:59:59Z',
        minRelevance: 0.7,
        page: 2,
        limit: 50,
        sortBy: 'relevance',
        sortOrder: 'desc',
      });
      expect(result.minRelevance).toBe(0.7);
      expect(result.sortBy).toBe('relevance');
    });

    it('should coerce minRelevance', () => {
      const result = newsFiltersSchema.parse({
        minRelevance: '0.5',
      });
      expect(result.minRelevance).toBe(0.5);
    });
  });
});
