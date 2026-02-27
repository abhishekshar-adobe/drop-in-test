import DLM from './nlp/dlm.js';
import IntentDetector from './nlp/intentDetector.js';
import ConfidenceScorer from './nlp/confidence.js';
import Clarification from './nlp/clarification.js';
import ActionExecutor from './actions/executor.js';
import Logger from './utils/logger.js';
import config from '../config/config.js';
import LLMService from './llm/llmService.js';
import LLMInputProcessor from './llm/llmInputProcessor.js';
import LLMResponseGenerator from './llm/llmResponseGenerator.js';

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

    // LLM integration (Ollama / Llama 3.1)
    this.llmService = new LLMService();
    this.llmInput = new LLMInputProcessor(this.llmService);
    this.llmResponse = new LLMResponseGenerator(this.llmService);
    this.llmAvailable = null; // null = unknown, updated after first check
    
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
      let scoredIntents;
      let usedLLM = false;

      // ── LLM-first path ────────────────────────────────────────────────
      // Try the LLM for intent detection & entity extraction.
      // If it succeeds we skip Steps 1-3 (DLM, IntentDetector, ConfidenceScorer).
      // On failure we fall through to the rule-based pipeline.
      try {
        const llmIntents = await this.llmInput.processInput(
          userInput,
          this.conversationContext.history,
        );
        if (llmIntents && llmIntents.length > 0) {
          scoredIntents = llmIntents;
          // Attach original text for analytics queries
          scoredIntents.forEach(intent => { intent.text = userInput; });
          usedLLM = true;
          this.llmAvailable = true;
          this.logger.info('LLM intent detection succeeded:', scoredIntents.map(i => i.name));
        }
      } catch (llmErr) {
        this.logger.warn('LLM input processing error, falling back:', llmErr.message);
      }

      // ── Rule-based fallback (Steps 1-3) ───────────────────────────────
      if (!scoredIntents || scoredIntents.length === 0) {
        // Step 1: Domain Language Model processing
        const dlmOutput = await this.dlm.process(userInput);
        this.logger.debug('DLM output:', dlmOutput);

        // Step 2: Multi-intent detection
        const intents = this.intentDetector.detect(dlmOutput);
        this.logger.debug('Detected intents:', intents);
      
        // Add original text to each intent for analytics queries
        intents.forEach(intent => {
          intent.text = userInput;
        });

        // Step 3: Confidence scoring
        scoredIntents = this.confidenceScorer.score(intents);
      }

      this.logger.debug('Scored intents:', scoredIntents);

      // Build processing steps for UI display (multi-intent)
      const processingSteps = scoredIntents.map((intent, index) => ({
        step: index + 1,
        action: this.getIntentDisplayName(intent.name),
        intent: intent.name,
        entities: intent.entities
      }));

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
        
        // If there's a clarification intent (like product_search), execute it
        if (slotValidation.clarificationIntent) {
          const searchIntent = slotValidation.clarificationIntent;
          const results = await this.executor.execute([searchIntent]);
          this.conversationContext.lastSearchResults = results[0]?.data;
          
          // Check if user specified a product number in the original query
          const pendingIntent = slotValidation.pendingIntent;
          const productNumber = pendingIntent.entities.quantity;
          
          // If quantity is 1-5 and matches a product position, auto-select it
          if (productNumber >= 1 && productNumber <= 5 && results[0]?.data?.items) {
            const items = results[0].data.items;
            if (productNumber <= items.length) {
              const selectedProduct = items[productNumber - 1];
              
              // Update pending intent with the selected product SKU
              pendingIntent.entities.sku = selectedProduct.sku;
              pendingIntent.entities.product = selectedProduct.name;
              pendingIntent.entities.quantity = 1; // Reset quantity to 1 (was product number)
              pendingIntent.confidenceLevel = 'high';
              
              // Execute the pending action immediately
              const actionResults = await this.executor.execute([pendingIntent]);
              
              // Build response with search results + action result
              const searchMessage = results[0]?.message || '';
              const actionMessage = actionResults[0]?.message || '';
              
              return {
                success: true,
                intent: results[0]?.intent || searchIntent.name,
                message: `${searchMessage}\n\n${actionMessage}`,
                data: results[0]?.data,
                displayAs: results[0]?.displayAs || 'text',
                processingSteps: processingSteps,
                autoCompleted: true
              };
            }
          }
          
          // Build response with search results + clarification message
          const searchMessage = results[0]?.message || '';
          const clarificationMsg = slotValidation.message;
          
          return {
            success: true,
            intent: results[0]?.intent || searchIntent.name, // Include intent for frontend routing
            message: searchMessage ? `${searchMessage}\n\n💡 ${clarificationMsg}` : `💡 ${clarificationMsg}`,
            data: results[0]?.data,
            displayAs: results[0]?.displayAs || 'text',
            needsSelection: true,
            processingSteps: processingSteps // Include processing steps
          };
        }
        
        // No clarification intent, just return the message
        return {
          success: true,
          message: slotValidation.message,
          needsSelection: true
        };
      }

      // Step 5: Execute actions
      const results = await this.executor.execute(scoredIntents);
      this.logger.info('Action results:', results);

      // ── LLM response enhancement ─────────────────────────────────────
      // For text-display results, try generating a more natural response
      // via the LLM. Falls back to the template message on failure.
      for (const result of results) {
        if (result.displayAs !== 'ui' && result.intent && result.message) {
          try {
            const enhanced = await this.llmResponse.generateOrFallback(
              result.intent,
              result,
              this.conversationContext.history,
            );
            if (enhanced) {
              result.message = enhanced;
            }
          } catch (respErr) {
            this.logger.warn('LLM response generation error:', respErr.message);
            // Keep original template message
          }
        }
      }

      // Update conversation context
      this.conversationContext.history.push({
        input: userInput,
        intents: scoredIntents,
        results
      });

      const response = this.formatResponse(results);
      
      // Add processing steps if multiple intents
      if (processingSteps.length > 1) {
        response.processingSteps = processingSteps;
      }

      // Tag whether LLM was used (for UI status indicator)
      response.usedLLM = usedLLM;
      
      return response;
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
          clarificationIntent: {
            name: 'view_orders',
            entities: {},
            confidenceLevel: 'high'
          },
          message: `📝 Which order would you like to track? Please provide the order number from above.`
        };
      }
      
      // Check cancel_order which requires order_number and reason
      if (intent.name === 'cancel_order') {
        if (!intent.entities.order_number) {
          return {
            needsClarification: true,
            pendingIntent: intent,
            clarificationIntent: {
              name: 'view_orders',
              entities: {},
              confidenceLevel: 'high'
            },
            message: `📝 Which order would you like to cancel? Please select an order number from above.`
          };
        }
        if (!intent.entities.reason) {
          return {
            needsClarification: true,
            pendingIntent: intent,
            message: `📝 Please provide a reason for cancelling order #${intent.entities.order_number}.`
          };
        }
      }
      
      // Check return_order which requires order_number and reason
      if (intent.name === 'return_order') {
        if (!intent.entities.order_number) {
          return {
            needsClarification: true,
            pendingIntent: intent,
            clarificationIntent: {
              name: 'view_orders',
              entities: {},
              confidenceLevel: 'high'
            },
            message: `📝 Which order would you like to return? Please select an order number from above.`
          };
        }
        if (!intent.entities.reason) {
          return {
            needsClarification: true,
            pendingIntent: intent,
            message: `📝 Please provide a reason for returning order #${intent.entities.order_number}.`
          };
        }
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

    // Filter out empty messages and join
    const messages = results
      .map(r => r.message)
      .filter(msg => msg && msg.trim())
      .join('\n\n');
    
    // If first result is UI display, return it directly without wrapping
    if (results[0]?.displayAs === 'ui') {
      return results[0];
    }
    
    return {
      success: true,
      message: messages,
      data: results,
      action: results[0]?.intent, // Pass the action type for UI rendering
      displayAs: results[0]?.displayAs // Pass display mode
    };
  }

  /**
   * Get conversation context
   */
  getContext() {
    return this.conversationContext;
  }

  /**
   * Get display name for intent
   */
  getIntentDisplayName(intentName) {
    const displayNames = {
      'product_search': 'Search for products',
      'add_to_cart': 'Add to cart',
      'add_to_wishlist': 'Add to wishlist',
      'check_price': 'Check price',
      'view_orders': 'View orders',
      'track_order': 'Track order',
      'view_cart': 'View cart',
      'place_order': 'Place order',
      'cancel_order': 'Cancel order',
      'return_order': 'Request return',
      'analytics_query': 'Analytics',
      'reset_cart': 'Clear cart'
    };
    return displayNames[intentName] || intentName;
  }

  /**
   * Check if the LLM is available (for UI status indicator)
   * @returns {Promise<boolean>}
   */
  async isLLMAvailable() {
    try {
      const available = await this.llmService.isAvailable();
      this.llmAvailable = available;
      return available;
    } catch {
      this.llmAvailable = false;
      return false;
    }
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
