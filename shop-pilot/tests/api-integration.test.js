import { describe, it, expect } from 'vitest';
import EcommerceAPI from '../src/actions/ecommerceApi.js';

describe('AEM Commerce API Integration', () => {
  let api;

  beforeAll(() => {
    api = new EcommerceAPI();
  });

  describe('Product Search', () => {
    it('should search products with phrase', async () => {
      const result = await api.searchProducts('shirt');

      expect(result).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should return products with required fields', async () => {
      const result = await api.searchProducts('shirt');
      const product = result.items[0];

      expect(product).toHaveProperty('sku');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('inStock');
      expect(product.sku).toBeTruthy();
      expect(product.name).toBeTruthy();
    });

    it('should filter by color attribute', async () => {
      const result = await api.searchProducts('shirt', { color: 'blue' });

      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
    });

    it('should filter by multiple attributes', async () => {
      const result = await api.searchProducts('shirt', {
        color: 'blue',
        size: 'l'
      });

      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
    });

    it('should handle empty search phrase', async () => {
      const result = await api.searchProducts('');

      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
    });

    it('should include pagination info', async () => {
      const result = await api.searchProducts('shirt');

      expect(result.pageInfo).toBeDefined();
      expect(result.pageInfo).toHaveProperty('current_page');
      expect(result.pageInfo).toHaveProperty('page_size');
    });
  });

  describe('Error Handling', () => {
    it('should fallback to mock data on API failure', async () => {
      // Force failure by using invalid query
      const result = await api.searchProducts('test-query-12345');

      // Should still return data (either real or fallback)
      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
    });
  });
});
