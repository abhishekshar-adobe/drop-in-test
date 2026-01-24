import DLM from './nlp/dlm.js';
import IntentDetector from './nlp/intentDetector.js';
import ConfidenceScorer from './nlp/confidence.js';
import Clarification from './nlp/clarification.js';
import ActionExecutor from './actions/executor.js';
import Logger from './utils/logger.js';
import config from '../config/config.js';

/**
 * Main Shop Pilot Chatbot Class
 * Orchestrates the entire NLP → Action pipeline
 */
export default class ShopPilot {
  constructor() {
    this.dlm = new DLM();
    this.intentDetector = new IntentDetector();
    this.confidenceScorer = new ConfidenceScorer();
    this.clarification = new Clarification();
    this.executor = new ActionExecutor();
    this.logger = new Logger();
    
    this.conversationContext = {
      history: [],
      currentIntent: null,
      awaitingClarification: false,
      lastProducts: []
    };
  }

  /**
   * Main processing pipeline
   * @param {string} userInput - Raw user input
   * @returns {Promise<Object>} Response object
   */
  async process(userInput) {
    this.logger.info('Processing user input:', userInput);

    try {
      // Step 1: Domain Language Model processing
      const dlmOutput = await this.dlm.process(userInput);
      this.logger.debug('DLM output:', dlmOutput);

      // Step 2: Multi-intent detection
      const intents = this.intentDetector.detect(dlmOutput);
      this.logger.debug('Detected intents:', intents);

      // Step 3: Confidence scoring
      const scoredIntents = this.confidenceScorer.score(intents);
      this.logger.debug('Scored intents:', scoredIntents);

      // Step 4: Check if clarification needed
      if (this.needsClarification(scoredIntents)) {
        const clarificationResponse = this.clarification.generate(scoredIntents);
        this.conversationContext.awaitingClarification = true;
        return clarificationResponse;
      }

      // Step 4.5: Validate required slots and trigger clarification if needed
      const slotValidation = this.validateSlots(scoredIntents);
      if (slotValidation.needsClarification) {
        // Store pending action and trigger product search first
        this.conversationContext.pendingAction = slotValidation.pendingIntent;
        const searchIntent = slotValidation.clarificationIntent;
        const results = await this.executor.execute([searchIntent]);
        this.conversationContext.lastSearchResults = results[0]?.data;
        
        return {
          success: true,
          message: results[0]?.message + '\n\n💡 ' + slotValidation.message,
          data: results[0]?.data,
          needsSelection: true
        };
      }

      // Step 5: Execute actions
      const results = await this.executor.execute(scoredIntents);
      this.logger.info('Action results:', results);

      // Update conversation context
      this.conversationContext.history.push({
        input: userInput,
        intents: scoredIntents,
        results
      });

      return this.formatResponse(results);
    } catch (error) {
      this.logger.error('Processing error:', error);
      return {
        success: false,
        message: '⚠️ Sorry, I encountered an error. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Check if clarification is needed based on confidence scores
   */
  needsClarification(scoredIntents) {
    if (scoredIntents.length === 0) return true;
    
    const topIntent = scoredIntents[0];
    return topIntent.confidence < config.thresholds.clarificationNeeded;
  }

  /**
   * Validate if required slots are present for each intent
   */
  validateSlots(scoredIntents) {
    for (const intent of scoredIntents) {
      // Check add_to_cart which requires SKU
      if (intent.name === 'add_to_cart' || intent.name === 'add_to_wishlist') {
        if (!intent.entities.sku) {
          // Missing SKU - need to search for products first
          const searchQuery = this.buildSearchQuery(intent.entities);
          return {
            needsClarification: true,
            pendingIntent: intent,
            clarificationIntent: {
              name: 'product_search',
              entities: {
                query: searchQuery,
                attributes: intent.entities.attributes || {}
              },
              confidenceLevel: 'high'
            },
            message: `Which product would you like to add? Please select from the results above.`
          };
        }
      }
      
      // Check track_order which requires order_number
      if (intent.name === 'track_order' && !intent.entities.order_number) {
        return {
          needsClarification: true,
          pendingIntent: intent,
          message: `📝 What's your order number?`
        };
      }
    }
    
    return { needsClarification: false };
  }

  /**
   * Build search query from entity attributes
   */
  buildSearchQuery(entities) {
    const parts = [];
    if (entities.attributes) {
      if (entities.attributes.color) parts.push(entities.attributes.color);
      if (entities.attributes.size) parts.push(entities.attributes.size);
      if (entities.attributes.material) parts.push(entities.attributes.material);
    }
    if (entities.product) parts.push(entities.product);
    return parts.join(' ') || 'products';
  }

  /**
   * Format final response for user
   */
  formatResponse(results) {
    if (!results || results.length === 0) {
      return {
        success: false,
        message: "I couldn't process that request. Can you rephrase?"
      };
    }

    const messages = results.map(r => r.message).join('\n\n');
    return {
      success: true,
      message: messages,
      data: results
    };
  }

  /**
   * Get conversation context
   */
  getContext() {
    return this.conversationContext;
  }

  /**
   * Reset conversation
   */
  reset() {
    this.conversationContext = {
      history: [],
      currentIntent: null,
      awaitingClarification: false,
      pendingAction: null,
      lastProducts: [],
      lastSearchResults: null
    };
  }
}
