import LLMService from './llmService.js';
import { buildInputMessages } from './prompts.js';
import Logger from '../utils/logger.js';

/**
 * LLM Input Processor
 * Uses Ollama (Llama 3.1) to perform intent detection and entity extraction
 * from free-form user text. Falls back to null on any failure so the caller
 * can transparently switch to the rule-based pipeline.
 */
export default class LLMInputProcessor {
  constructor(llmService) {
    this.llm = llmService || new LLMService();
    this.logger = new Logger();
  }

  /**
   * Process user input through the LLM to extract intents and entities.
   *
   * @param {string} userText — raw user message
   * @param {Array}  conversationHistory — recent [{input, intents, results}]
   * @returns {Promise<Array|null>}  Array of scored intents compatible with
   *   ConfidenceScorer output, or null if the LLM is unavailable / fails.
   */
  async processInput(userText, conversationHistory = []) {
    try {
      // Quick availability gate — avoids wasting time on prompt construction
      const available = await this.llm.isAvailable();
      if (!available) {
        this.logger.debug('LLM not available, skipping input processing');
        return null;
      }

      const startTime = Date.now();

      // Build the chat messages (system + few-shot + context + user)
      const messages = buildInputMessages(userText, conversationHistory);

      // Call Ollama chat endpoint
      const raw = await this.llm.chat(messages, {
        temperature: 0.3,
        timeout: 8000,
      });

      if (!raw) {
        this.logger.warn('LLM returned empty response for input processing');
        return null;
      }

      this.logger.debug(
        `LLM input processing took ${Date.now() - startTime}ms`,
      );

      // Parse the structured JSON from the LLM
      const parsed = this._parseResponse(raw);
      if (!parsed) return null;

      // Map to the format expected by the rest of the ShopPilot pipeline
      return this._mapToIntents(parsed);
    } catch (err) {
      this.logger.warn('LLM input processing failed:', err.message);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract and parse JSON from the LLM response.
   * Handles cases where the LLM wraps JSON in markdown code fences.
   * @param {string} raw
   * @returns {Object|null}
   */
  _parseResponse(raw) {
    try {
      // Strip markdown code fences if present
      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned
          .replace(/^```(?:json)?\s*\n?/, '')
          .replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned);

      // Basic validation — must have an intents array
      if (!parsed.intents || !Array.isArray(parsed.intents)) {
        this.logger.warn('LLM response missing intents array');
        return null;
      }

      return parsed;
    } catch (err) {
      this.logger.warn('Failed to parse LLM JSON response:', err.message);
      this.logger.debug('Raw LLM response:', raw);
      return null;
    }
  }

  /**
   * Map the LLM-parsed intents to the format expected by ConfidenceScorer
   * and ActionExecutor (matching what IntentDetector.detect() returns after
   * being scored by ConfidenceScorer.score()).
   *
   * @param {Object} parsed — { intents: [...] }
   * @returns {Array}
   */
  _mapToIntents(parsed) {
    const VALID_INTENTS = new Set([
      'product_search',
      'add_to_cart',
      'add_to_wishlist',
      'check_price',
      'view_orders',
      'track_order',
      'view_cart',
      'place_order',
      'cancel_order',
      'return_order',
      'analytics_query',
      'reset_cart',
    ]);

    const REQUIRED_SLOTS = {
      product_search: ['query'],
      add_to_cart: ['sku'],
      add_to_wishlist: ['sku'],
      check_price: ['product'],
      view_orders: [],
      track_order: ['order_number'],
      view_cart: [],
      place_order: [],
      cancel_order: ['order_number', 'reason'],
      return_order: ['order_number', 'reason'],
      analytics_query: [],
      reset_cart: [],
    };

    return parsed.intents
      .filter((i) => i.name && VALID_INTENTS.has(i.name))
      .map((i) => {
        const confidence = Math.min(Math.max(i.confidence ?? 0.5, 0), 1);
        const entities = this._normalizeEntities(i.name, i.entities || {});

        return {
          name: i.name,
          rawScore: confidence,
          confidence,
          confidenceLevel: this._getConfidenceLevel(confidence),
          priority: this._getPriority(i.name),
          entities,
          requiredSlots: REQUIRED_SLOTS[i.name] || [],
          source: 'llm', // Tag so the pipeline knows this came from the LLM
        };
      });
  }

  /**
   * Normalize and clean entities from the LLM output.
   * Handles nulls, ensures correct types, and builds the query string for
   * product_search if the LLM didn't set it.
   */
  _normalizeEntities(intentName, raw) {
    const entities = {};

    // Copy basic fields, dropping null/undefined
    if (raw.product) entities.product = String(raw.product);
    if (raw.sku) entities.sku = String(raw.sku).toUpperCase();
    if (raw.quantity != null) entities.quantity = Number(raw.quantity) || 1;
    if (raw.order_number) entities.order_number = String(raw.order_number);
    if (raw.reason) entities.reason = String(raw.reason);

    // Attributes object
    if (raw.attributes && typeof raw.attributes === 'object') {
      const attrs = {};
      if (raw.attributes.color) attrs.color = raw.attributes.color;
      if (raw.attributes.size) attrs.size = raw.attributes.size;
      if (raw.attributes.material) attrs.material = raw.attributes.material;
      if (Object.keys(attrs).length > 0) entities.attributes = attrs;
    }

    // product_search: ensure query is set
    if (intentName === 'product_search') {
      if (raw.query) {
        entities.query = String(raw.query);
      } else {
        // Build query from product + attributes
        const parts = [];
        if (entities.attributes?.color) parts.push(entities.attributes.color);
        if (entities.attributes?.size) parts.push(entities.attributes.size);
        if (entities.attributes?.material)
          parts.push(entities.attributes.material);
        if (entities.product) parts.push(entities.product);
        entities.query = parts.join(' ') || 'products';
      }
    }

    // analytics_query: set text for analytics utils
    if (intentName === 'analytics_query' && raw.query) {
      entities.query = String(raw.query);
    }

    return entities;
  }

  /** Map confidence 0-1 to label */
  _getConfidenceLevel(score) {
    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  /** Default priority by intent (mirrors intents.json) */
  _getPriority(name) {
    const priorities = {
      product_search: 0.7,
      add_to_cart: 0.9,
      add_to_wishlist: 0.85,
      check_price: 0.6,
      view_orders: 0.8,
      track_order: 0.85,
      view_cart: 0.8,
      place_order: 0.95,
      cancel_order: 0.9,
      return_order: 0.9,
      analytics_query: 0.9,
      reset_cart: 0.85,
    };
    return priorities[name] ?? 0.5;
  }
}
