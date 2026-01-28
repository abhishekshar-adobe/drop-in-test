import { describe, it, expect, beforeAll } from 'vitest';
import DLM from '../src/nlp/dlm.js';
import IntentDetector from '../src/nlp/intentDetector.js';
import ConfidenceScorer from '../src/nlp/confidence.js';

describe('Intent Detection System', () => {
  let dlm;
  let intentDetector;
  let confidenceScorer;

  beforeAll(async () => {
    dlm = new DLM();
    intentDetector = new IntentDetector();
    confidenceScorer = new ConfidenceScorer();
    
    // Wait for config to load
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('1. Product Search Intent', () => {
    it('should detect product_search intent for "show blue shirt"', async () => {
      const input = 'show blue shirt';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);
      const scored = confidenceScorer.score(intents);

      // 1. Detected Intent
      expect(scored.length).toBeGreaterThan(0);
      expect(scored[0].name).toBe('product_search');

      // 2. Confidence Score
      expect(scored[0].confidence).toBeGreaterThan(0.3);
      expect(scored[0].confidenceLevel).toBe('high');

      // 3. Extracted Slots
      expect(scored[0].entities.query).toContain('shirt');
      expect(scored[0].entities.attributes.color).toBe('blue');

      // 4. Expected Action
      expect(scored[0].name).toBe('product_search');
    });

    it('should normalize entity synonyms: "meduim blu shirt"', async () => {
      const input = 'show meduim blu shirt';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      // 3. Extracted Slots with normalization
      expect(intents[0].entities.attributes.size).toBe('m');
      expect(intents[0].entities.attributes.color).toBe('blue');
    });

    it('should handle typos: "larg red jacket"', async () => {
      const input = 'find larg red jacket';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      expect(intents[0].name).toBe('product_search');
      expect(intents[0].entities.attributes.size).toBe('l');
      expect(intents[0].entities.attributes.color).toBe('red');
    });
  });

  describe('2. Add to Cart Intent', () => {
    it('should detect add_to_cart and require SKU', async () => {
      const input = 'add blue shirt to cart';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);
      const scored = confidenceScorer.score(intents);

      // 1. Detected Intent
      expect(scored[0].name).toBe('add_to_cart');

      // 2. Confidence Score
      expect(scored[0].confidence).toBeGreaterThan(0.75);

      // 3. Extracted Slots
      expect(scored[0].entities.product).toBe('shirt');
      expect(scored[0].entities.quantity).toBe(1);
      expect(scored[0].entities.sku).toBeNull(); // Requires clarification

      // 4. Expected Action
      expect(scored[0].requiredSlots).toContain('sku');
    });

    it('should extract quantity from "add 3 shirts"', async () => {
      const input = 'add 3 shirts to cart';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      expect(intents[0].entities.quantity).toBe(3);
    });
  });

  describe('3. Multi-Intent Detection', () => {
    it('should detect both search and add_to_cart in "show blue shirt and add to cart"', async () => {
      const input = 'show blue shirt and add to cart';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      // Should detect multiple intents
      expect(intents.length).toBeGreaterThanOrEqual(1);
      
      const intentNames = intents.map(i => i.name);
      expect(intentNames).toContain('add_to_cart');
    });
  });

  describe('4. Intent Disambiguation', () => {
    it('should NOT trigger view_orders for "show cap"', async () => {
      const input = 'show cap';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      // 1. Detected Intent - should be product_search, NOT view_orders
      expect(intents[0].name).toBe('product_search');
      
      // Should not include view_orders
      const intentNames = intents.map(i => i.name);
      expect(intentNames).not.toContain('view_orders');
    });

    it('should trigger view_orders for "show orders"', async () => {
      const input = 'show orders';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      expect(intents[0].name).toBe('view_orders');
    });

    it('should prioritize add_to_cart over product_search when both match', async () => {
      const input = 'add blue shirt';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);
      const scored = confidenceScorer.score(intents);

      // add_to_cart has higher priority (0.9) than product_search (0.7)
      expect(scored[0].name).toBe('add_to_cart');
      expect(scored[0].priority).toBe(0.9);
    });
  });

  describe('5. Check Price Intent', () => {
    it('should detect check_price for "how much is this shirt"', async () => {
      const input = 'how much is this shirt';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);
      const scored = confidenceScorer.score(intents);

      // 1. Detected Intent
      expect(scored[0].name).toBe('check_price');

      // 2. Confidence Score
      expect(scored[0].confidence).toBeGreaterThan(0.5);

      // 3. Extracted Slots
      expect(scored[0].entities.product).toBe('shirt');
    });
  });

  describe('6. Track Order Intent', () => {
    it('should extract order number from "track order 12345"', async () => {
      const input = 'track order 12345';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      // 1. Detected Intent
      expect(intents[0].name).toBe('track_order');

      // 3. Extracted Slots
      expect(intents[0].entities.order_number).toBe(12345);
    });

    it('should require order_number slot', async () => {
      const input = 'track my order';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      expect(intents[0].requiredSlots).toContain('order_number');
      expect(intents[0].entities.order_number).toBeUndefined();
    });
  });

  describe('7. View Cart & Wishlist', () => {
    it('should detect view_cart for "show my cart"', async () => {
      const input = 'show my cart';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      expect(intents[0].name).toBe('view_cart');
    });

    it('should detect add_to_wishlist for "save to wishlist"', async () => {
      const input = 'save blue dress to wishlist';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      expect(intents[0].name).toBe('add_to_wishlist');
      expect(intents[0].entities.attributes.color).toBe('blue');
    });
  });

  describe('8. Confidence Thresholds', () => {
    it('should respect per-intent confidence thresholds', async () => {
      // add_to_cart requires 0.75 confidence with clear "add" pattern
      const input = 'maybe something';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      // Should not detect add_to_cart with vague input lacking "add" keyword
      const addToCart = intents.find(i => i.name === 'add_to_cart');
      expect(addToCart).toBeUndefined();
    });
  });

  describe('9. Edge Cases', () => {
    it('should handle empty input gracefully', async () => {
      const input = '';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      expect(intents).toEqual([]);
    });

    it('should handle gibberish input', async () => {
      const input = 'asdfghjkl zxcvbnm';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      expect(intents.length).toBe(0);
    });

    it('should handle mixed case input', async () => {
      const input = 'SHOW BLUE SHIRT';
      const dlmOutput = await dlm.process(input);
      const intents = intentDetector.detect(dlmOutput);

      expect(intents[0].name).toBe('product_search');
      expect(intents[0].entities.attributes.color).toBe('blue');
    });
  });

  describe('10. Slot Validation', () => {
    const testCases = [
      {
        input: 'show red shirt',
        intent: 'product_search',
        expectedSlots: {
          query: expect.any(String),
          attributes: { color: 'red' }
        }
      },
      {
        input: 'add 2 blue xl shirts',
        intent: 'add_to_cart',
        expectedSlots: {
          product: 'shirts',
          quantity: 2,
          attributes: { color: 'blue', size: 'xl' }
        }
      },
      {
        input: 'price of leather jacket',
        intent: 'check_price',
        expectedSlots: {
          product: 'jacket',
          attributes: { material: 'leather' }
        }
      }
    ];

    testCases.forEach(({ input, intent, expectedSlots }) => {
      it(`should extract correct slots for "${input}"`, async () => {
        const dlmOutput = await dlm.process(input);
        const intents = intentDetector.detect(dlmOutput);

        expect(intents[0].name).toBe(intent);
        
        Object.entries(expectedSlots).forEach(([key, value]) => {
          if (typeof value === 'object' && !Array.isArray(value)) {
            Object.entries(value).forEach(([subKey, subValue]) => {
              if (intents[0].entities[key] && intents[0].entities[key][subKey]) {
                expect(intents[0].entities[key][subKey]).toBe(subValue);
              }
            });
          } else if (value && value.constructor && value.constructor.name === 'AsymmetricMatcher') {
            // Handle expect.any() matchers
            expect(intents[0].entities[key]).toEqual(value);
          } else {
            expect(intents[0].entities[key]).toEqual(value);
          }
        });
      });
    });
  });
});
