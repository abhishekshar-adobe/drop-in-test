import { describe, it, expect, vi, beforeEach } from 'vitest';
import LLMService from '../src/llm/llmService.js';
import LLMInputProcessor from '../src/llm/llmInputProcessor.js';
import LLMResponseGenerator from '../src/llm/llmResponseGenerator.js';
import { buildInputMessages, buildResponseMessages } from '../src/llm/prompts.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mock LLM Service for deterministic tests
// ─────────────────────────────────────────────────────────────────────────────

function createMockLLMService(chatResponse = null, available = true) {
  return {
    isAvailable: vi.fn().mockResolvedValue(available),
    generate: vi.fn().mockResolvedValue(chatResponse),
    chat: vi.fn().mockResolvedValue(chatResponse),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Builders
// ─────────────────────────────────────────────────────────────────────────────

describe('Prompt Builders', () => {
  it('buildInputMessages includes system prompt and user message', () => {
    const messages = buildInputMessages('show me blue shoes');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('e-commerce intent classifier');
    expect(messages[messages.length - 1].role).toBe('user');
    expect(messages[messages.length - 1].content).toBe('show me blue shoes');
  });

  it('buildInputMessages includes conversation history context', () => {
    const history = [
      { input: 'show me shoes', intents: [{ name: 'product_search' }], results: [] },
    ];
    const messages = buildInputMessages('add the first one', history);
    const contextMsg = messages.find(
      (m) => m.role === 'system' && m.content.includes('Recent conversation'),
    );
    expect(contextMsg).toBeTruthy();
    expect(contextMsg.content).toContain('product_search');
  });

  it('buildInputMessages includes few-shot examples', () => {
    const messages = buildInputMessages('test');
    const userExamples = messages.filter(
      (m) => m.role === 'user' && m !== messages[messages.length - 1],
    );
    expect(userExamples.length).toBeGreaterThan(0);
  });

  it('buildResponseMessages includes system prompt and action data', () => {
    const messages = buildResponseMessages('add_to_cart', {
      success: true,
      message: 'Added item',
      data: { product: { name: 'Blue Shoes' } },
    });
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('friendly');
    expect(messages[1].content).toContain('add_to_cart');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LLM Input Processor
// ─────────────────────────────────────────────────────────────────────────────

describe('LLMInputProcessor', () => {
  let processor;

  describe('when LLM is available', () => {
    it('parses product_search intent from LLM response', async () => {
      const mockResponse = JSON.stringify({
        intents: [
          {
            name: 'product_search',
            confidence: 0.95,
            entities: {
              product: 'running shoes',
              query: 'blue running shoes',
              attributes: { color: 'blue' },
            },
          },
        ],
      });
      const mock = createMockLLMService(mockResponse);
      processor = new LLMInputProcessor(mock);

      const result = await processor.processInput('show me blue running shoes');
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('product_search');
      expect(result[0].confidence).toBeCloseTo(0.95);
      expect(result[0].confidenceLevel).toBe('high');
      expect(result[0].entities.query).toBe('blue running shoes');
      expect(result[0].entities.attributes.color).toBe('blue');
      expect(result[0].source).toBe('llm');
    });

    it('parses add_to_cart intent with SKU', async () => {
      const mockResponse = JSON.stringify({
        intents: [
          {
            name: 'add_to_cart',
            confidence: 0.98,
            entities: { sku: 'WSH12', quantity: 2 },
          },
        ],
      });
      processor = new LLMInputProcessor(createMockLLMService(mockResponse));

      const result = await processor.processInput('add 2 WSH12 to cart');
      expect(result[0].name).toBe('add_to_cart');
      expect(result[0].entities.sku).toBe('WSH12');
      expect(result[0].entities.quantity).toBe(2);
    });

    it('handles track_order with typos', async () => {
      const mockResponse = JSON.stringify({
        intents: [
          {
            name: 'track_order',
            confidence: 0.93,
            entities: { order_number: '45678' },
          },
        ],
      });
      processor = new LLMInputProcessor(createMockLLMService(mockResponse));

      const result = await processor.processInput('trck my ordr 45678');
      expect(result[0].name).toBe('track_order');
      expect(result[0].entities.order_number).toBe('45678');
    });

    it('handles multi-intent detection', async () => {
      const mockResponse = JSON.stringify({
        intents: [
          { name: 'product_search', confidence: 0.9, entities: { query: 'shoes' } },
          { name: 'check_price', confidence: 0.75, entities: { product: 'shoes' } },
        ],
      });
      processor = new LLMInputProcessor(createMockLLMService(mockResponse));

      const result = await processor.processInput('find shoes and check price');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('product_search');
      expect(result[1].name).toBe('check_price');
    });

    it('filters out invalid intents', async () => {
      const mockResponse = JSON.stringify({
        intents: [
          { name: 'product_search', confidence: 0.9, entities: { query: 'shoes' } },
          { name: 'invalid_intent', confidence: 0.8, entities: {} },
        ],
      });
      processor = new LLMInputProcessor(createMockLLMService(mockResponse));

      const result = await processor.processInput('test');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('product_search');
    });

    it('handles markdown-fenced JSON response', async () => {
      const mockResponse =
        '```json\n' +
        JSON.stringify({
          intents: [{ name: 'view_cart', confidence: 0.95, entities: {} }],
        }) +
        '\n```';
      processor = new LLMInputProcessor(createMockLLMService(mockResponse));

      const result = await processor.processInput('show my cart');
      expect(result[0].name).toBe('view_cart');
    });

    it('normalizes attribute entities from synonyms', async () => {
      const mockResponse = JSON.stringify({
        intents: [
          {
            name: 'product_search',
            confidence: 0.92,
            entities: {
              product: 'jacket',
              query: 'navy leather jacket',
              attributes: { color: 'blue', material: 'leather' },
            },
          },
        ],
      });
      processor = new LLMInputProcessor(createMockLLMService(mockResponse));

      const result = await processor.processInput('find me a navy leather jacket');
      expect(result[0].entities.attributes.color).toBe('blue');
      expect(result[0].entities.attributes.material).toBe('leather');
    });
  });

  describe('when LLM is unavailable', () => {
    it('returns null when LLM is not available', async () => {
      processor = new LLMInputProcessor(createMockLLMService(null, false));
      const result = await processor.processInput('hello');
      expect(result).toBeNull();
    });

    it('returns null when LLM returns empty response', async () => {
      processor = new LLMInputProcessor(createMockLLMService(null, true));
      const result = await processor.processInput('hello');
      expect(result).toBeNull();
    });

    it('returns null when LLM returns invalid JSON', async () => {
      processor = new LLMInputProcessor(
        createMockLLMService('not valid json', true),
      );
      const result = await processor.processInput('hello');
      expect(result).toBeNull();
    });

    it('returns null when LLM response has no intents array', async () => {
      processor = new LLMInputProcessor(
        createMockLLMService(JSON.stringify({ something: 'else' }), true),
      );
      const result = await processor.processInput('hello');
      expect(result).toBeNull();
    });

    it('returns null when LLM throws an error', async () => {
      const mock = createMockLLMService(null, true);
      mock.chat.mockRejectedValue(new Error('Network error'));
      processor = new LLMInputProcessor(mock);

      const result = await processor.processInput('hello');
      expect(result).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LLM Response Generator
// ─────────────────────────────────────────────────────────────────────────────

describe('LLMResponseGenerator', () => {
  let generator;

  describe('when LLM is available', () => {
    it('generates natural response for add_to_cart', async () => {
      const natural = 'Great! I\'ve added the Blue Shoes to your cart. 🛒';
      generator = new LLMResponseGenerator(createMockLLMService(natural));

      const result = await generator.formatResponse('add_to_cart', {
        success: true,
        intent: 'add_to_cart',
        message: '✅ Added Blue Shoes to cart',
        data: { product: { name: 'Blue Shoes' } },
      });

      expect(result).toBe(natural);
    });

    it('rejects JSON responses from LLM', async () => {
      generator = new LLMResponseGenerator(
        createMockLLMService('{"json": "response"}'),
      );

      const result = await generator.formatResponse('add_to_cart', {
        success: true,
        message: 'template message',
        data: {},
      });

      expect(result).toBeNull();
    });

    it('skips LLM for UI-display responses', async () => {
      generator = new LLMResponseGenerator(
        createMockLLMService('should not be used'),
      );

      const result = await generator.formatResponse('product_search', {
        success: true,
        displayAs: 'ui',
        message: '',
        data: { items: [] },
      });

      expect(result).toBeNull();
    });

    it('truncates overly long responses', async () => {
      const longText = 'A'.repeat(600);
      generator = new LLMResponseGenerator(createMockLLMService(longText));

      const result = await generator.formatResponse('track_order', {
        success: true,
        message: 'test',
        data: {},
      });

      expect(result.length).toBeLessThanOrEqual(500);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('when LLM is unavailable', () => {
    it('returns null when LLM is not available', async () => {
      generator = new LLMResponseGenerator(createMockLLMService(null, false));
      const result = await generator.formatResponse('add_to_cart', {
        success: true,
        message: 'test',
        data: {},
      });
      expect(result).toBeNull();
    });

    it('generateOrFallback returns template when LLM fails', async () => {
      generator = new LLMResponseGenerator(createMockLLMService(null, false));

      const result = await generator.generateOrFallback('view_cart', {
        success: true,
        intent: 'view_cart',
        message: '🛒 You have 3 items in your cart',
        data: { items: [1, 2, 3], total: { value: 50 } },
      });

      // Should return something (template or raw message)
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('generateOrFallback returns raw message as last resort', async () => {
      generator = new LLMResponseGenerator(createMockLLMService(null, false));

      const result = await generator.generateOrFallback('unknown_intent', {
        success: true,
        message: 'raw fallback message',
        data: {},
      });

      expect(result).toBe('raw fallback message');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full Pipeline Integration (with mocked LLM)
// ─────────────────────────────────────────────────────────────────────────────

describe('Pipeline Integration', () => {
  it('LLM intents have correct shape for pipeline consumption', async () => {
    const mockResponse = JSON.stringify({
      intents: [
        {
          name: 'product_search',
          confidence: 0.92,
          entities: {
            product: 'sneakers',
            query: 'red sneakers',
            attributes: { color: 'red' },
          },
        },
      ],
    });
    const processor = new LLMInputProcessor(createMockLLMService(mockResponse));
    const intents = await processor.processInput('find red sneakers');

    // Verify the shape matches what ConfidenceScorer and ActionExecutor expect
    const intent = intents[0];
    expect(intent).toHaveProperty('name');
    expect(intent).toHaveProperty('rawScore');
    expect(intent).toHaveProperty('confidence');
    expect(intent).toHaveProperty('confidenceLevel');
    expect(intent).toHaveProperty('priority');
    expect(intent).toHaveProperty('entities');
    expect(intent).toHaveProperty('requiredSlots');
    expect(intent).toHaveProperty('source', 'llm');

    // Entities should have the query field for product_search
    expect(intent.entities.query).toBe('red sneakers');
  });

  it('LLM intents for add_to_cart include requiredSlots', async () => {
    const mockResponse = JSON.stringify({
      intents: [
        {
          name: 'add_to_cart',
          confidence: 0.97,
          entities: { product: 'jacket', sku: 'JKT001', quantity: 1 },
        },
      ],
    });
    const processor = new LLMInputProcessor(createMockLLMService(mockResponse));
    const intents = await processor.processInput('add JKT001 to cart');

    expect(intents[0].requiredSlots).toEqual(['sku']);
  });
});
