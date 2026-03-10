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
      lastIntent: null,
      awaitingClarification: false,
      lastProducts: [],
      contextTimestamp: null
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
      let dlmOutput; // Declare at top level so it's available throughout
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
          console.log('[ShopPilot] LLM detected intents:', scoredIntents.map(i => `${i.name} (conf: ${i.confidence})`));
        }
      } catch (llmErr) {
        this.logger.warn('LLM input processing error, falling back:', llmErr.message);
      }

      // ── Rule-based fallback (Steps 1-3) ───────────────────────────────
      if (!scoredIntents || scoredIntents.length === 0) {
        // Step 1: Domain Language Model processing
        dlmOutput = await this.dlm.process(userInput);
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

      // Step 4.5: Resolve product numbers to SKUs from context (BEFORE validation)
      // This allows "show 1" to become "show ACTUAL_SKU" before we check requirements
      console.log('[ShopPilot] Step 4.5: Resolving product numbers from context');
      console.log('[ShopPilot] Intents before resolution:', scoredIntents.map(i => `${i.name} (sku: ${i.entities?.sku || 'none'})`));
      this.resolveProductNumbers(scoredIntents, dlmOutput);
      console.log('[ShopPilot] Intents after resolution:', scoredIntents.map(i => `${i.name} (sku: ${i.entities?.sku || 'none'})`));

      // Step 4.6: Validate required context for context-dependent intents
      // Check this BEFORE slot validation so we can catch "show 1" without prior search
      console.log('[ShopPilot] Step 4.6: Validating context requirements');
      const contextValidation = this.validateContext(scoredIntents);
      if (contextValidation.needsClarification) {
        console.log('[ShopPilot] Context validation failed - intent requires prior context');
        return {
          success: false,
          message: contextValidation.message,
          suggestion: contextValidation.suggestion
        };
      }
      console.log('[ShopPilot] Context validation passed');

      // Step 4.7: Validate required slots and trigger clarification if needed
      console.log('[ShopPilot] Step 4.7: Validating required slots');
      const slotValidation = this.validateSlots(scoredIntents);
      if (slotValidation.needsClarification) {
        // Store pending action and trigger product search first
        this.conversationContext.pendingAction = slotValidation.pendingIntent;
        
        // If there's a clarification intent (like product_search), execute it
        if (slotValidation.clarificationIntent) {
          const searchIntent = slotValidation.clarificationIntent;
          const results = await this.executor.execute([searchIntent]);
          
          // Update context with search results
          if (results[0]?.intent === 'product_search' && results[0]?.data?.items) {
            this.conversationContext.lastProducts = results[0].data.items;
            this.conversationContext.lastIntent = 'product_search';
            this.conversationContext.contextTimestamp = Date.now();
            console.log('[ShopPilot] Context updated with', results[0].data.items.length, 'products from auto-search');
          }
          
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
      console.log('[ShopPilot] Slot validation passed');

      // Step 5: Execute actions
      console.log('[ShopPilot] Step 5: Executing actions for intents:', scoredIntents.map(i => i.name));
      const results = await this.executor.execute(scoredIntents);
      this.logger.info('Action results:', results);
      
      // Update context after successful execution
      for (const result of results) {
        if (result.success && result.intent === 'product_search' && result.data?.items) {
          this.conversationContext.lastProducts = result.data.items;
          this.conversationContext.lastIntent = 'product_search';
          this.conversationContext.contextTimestamp = Date.now();
          console.log('[ShopPilot] Context updated with', result.data.items.length, 'products');
        }
        
        // Clear product context after adding to cart/wishlist or selecting
        if (result.success && ['add_to_cart', 'add_to_wishlist'].includes(result.intent)) {
          // Don't clear immediately - keep context for follow-up actions
          console.log('[ShopPilot] Keeping product context for follow-up actions');
        }
      }

      // ── LLM response enhancement ─────────────────────────────────────
      // For text-display results, try generating a more natural response
      // via the LLM. Falls back to the template message on failure.
      for (const result of results) {
        if (result.displayAs !== 'ui' && result.intent && (result.message || result.requiresLLMSummary)) {
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
      // Check select_product which requires SKU
      if (intent.name === 'select_product') {
        if (!intent.entities.sku) {
          // Missing SKU - need to search for products first
          const searchQuery = intent.entities.product || intent.entities.query || 'products';
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
            message: `🔍 Please search for a product first, then select one to view details.`
          };
        }
      }
      
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
   * Validate if required context is available for context-dependent intents
   * Some intents (like add_to_cart with number selection) require previous context
   */
  validateContext(scoredIntents) {
    // Hard-coded context requirements to avoid async loading issues
    const CONTEXT_REQUIREMENTS = {
      'select_product': ['product_search'],
    'compare_products': ['product_search'],
    };
    
    for (const intent of scoredIntents) {
      const requiredContexts = CONTEXT_REQUIREMENTS[intent.name];
      
      if (requiredContexts && requiredContexts.length > 0) {
        console.log(`[ShopPilot] Checking context for ${intent.name}, requires:`, requiredContexts);
        
        // Check if context has expired
        if (this.isContextExpired()) {
          console.log('[ShopPilot] Context expired');
          return {
            needsClarification: true,
            message: '⏰ Product context has expired. Please search for products again.',
            suggestion: 'Try: "find shoes" or "search laptops"'
          };
        }
        
        // Check if any required context is present
        const hasContext = requiredContexts.some(ctx => {
          if (ctx === 'product_search') {
            const hasProducts = this.conversationContext.lastProducts && 
                   this.conversationContext.lastProducts.length > 0;
            console.log(`[ShopPilot] Has product context (lastProducts.length): ${this.conversationContext.lastProducts?.length || 0}`);
            return hasProducts;
          }
          return false;
        });
        
        if (!hasContext) {
          // Missing required context
          const contextName = requiredContexts[0];
          let message = '';
          let suggestion = '';
          
          if (contextName === 'product_search') {
            message = '🔍 Please search for products first before selecting one.';
            suggestion = 'Try: "find blue shoes" or "search for laptops"';
          } else {
            message = `⚠️ This action requires ${contextName} context. Please perform ${contextName} first.`;
          }
          
          console.log('[ShopPilot] Context validation failed:', message);
          return {
            needsClarification: true,
            message,
            suggestion
          };
        }
        
        console.log('[ShopPilot] Context validation passed for', intent.name);
      }
    }
    
    return { needsClarification: false };
  }

  /**
   * Resolve product numbers (like "1", "2", "3") to actual SKUs from context
   * When user says "show details of 1", map "1" to the first product SKU
   * When user says "compare 1 and 2", map both to respective SKUs
   */
  resolveProductNumbers(scoredIntents, dlmOutput) {
    // Only resolve for intents that work with products from context
    const contextIntents = ['select_product', 'compare_products', 'add_to_cart', 'add_to_wishlist', 'remove_from_cart'];
    
    for (const intent of scoredIntents) {
      if (!contextIntents.includes(intent.name)) continue;
      
      // Check if we have products in context
      if (!this.conversationContext.lastProducts || 
          this.conversationContext.lastProducts.length === 0) continue;
      
      // Handle compare_products - needs two numbers/SKUs
      if (intent.name === 'compare_products') {
        // First, check if sku1 or sku2 are already set but are numeric strings that need resolution
        const needsResolution1 = intent.entities.sku1 && this.isProductPosition(intent.entities.sku1);
        const needsResolution2 = intent.entities.sku2 && this.isProductPosition(intent.entities.sku2);
        
        if (needsResolution1) {
          const index1 = parseInt(intent.entities.sku1, 10);
          if (index1 >= 1 && index1 <= this.conversationContext.lastProducts.length) {
            const product1 = this.conversationContext.lastProducts[index1 - 1];
            if (product1 && product1.sku) {
              console.log(`[ShopPilot] Resolved sku1 position ${index1} to SKU: ${product1.sku}`);
              intent.entities.sku1 = product1.sku;
            }
          }
        }
        
        if (needsResolution2) {
          const index2 = parseInt(intent.entities.sku2, 10);
          if (index2 >= 1 && index2 <= this.conversationContext.lastProducts.length) {
            const product2 = this.conversationContext.lastProducts[index2 - 1];
            if (product2 && product2.sku) {
              console.log(`[ShopPilot] Resolved sku2 position ${index2} to SKU: ${product2.sku}`);
              intent.entities.sku2 = product2.sku;
            }
          }
        }
        
        // Also handle the case where both come from dlmOutput.numbers (not already set)
        if (dlmOutput && (!intent.entities.sku1 || !intent.entities.sku2)) {
          const numbers = dlmOutput.numbers.filter(n => {
            const num = typeof n === 'number' ? n : parseInt(n, 10);
            return num >= 1 && num <= this.conversationContext.lastProducts.length;
          });
          
          if (numbers.length >= 2) {
            if (!intent.entities.sku1) {
              const index1 = typeof numbers[0] === 'number' ? numbers[0] : parseInt(numbers[0], 10);
              const product1 = this.conversationContext.lastProducts[index1 - 1];
              if (product1 && product1.sku) {
                console.log(`[ShopPilot] Resolved product number ${index1} to SKU: ${product1.sku}`);
                intent.entities.sku1 = product1.sku;
              }
            }
            
            if (!intent.entities.sku2) {
              const index2 = typeof numbers[1] === 'number' ? numbers[1] : parseInt(numbers[1], 10);
              const product2 = this.conversationContext.lastProducts[index2 - 1];
              if (product2 && product2.sku) {
                console.log(`[ShopPilot] Resolved product number ${index2} to SKU: ${product2.sku}`);
                intent.entities.sku2 = product2.sku;
              }
            }
          }
        }
        
        continue; // Done with compare_products
      }
      
      // Handle single product intents (select_product, add_to_cart, add_to_wishlist)
      // Check if the SKU is already set but is a position number that needs resolution
      if (intent.entities.sku && this.isProductPosition(intent.entities.sku)) {
        const index = parseInt(intent.entities.sku, 10);
        if (index >= 1 && index <= this.conversationContext.lastProducts.length) {
          const selectedProduct = this.conversationContext.lastProducts[index - 1];
          
          if (selectedProduct && selectedProduct.sku) {
            console.log(`[ShopPilot] Resolved SKU position ${index} to actual SKU: ${selectedProduct.sku}`);
            
            // Update entities with the actual SKU
            intent.entities.sku = selectedProduct.sku;
            intent.entities.product = selectedProduct.name || selectedProduct.title;
            
            // For add_to_cart, ensure quantity is set
            if (intent.name === 'add_to_cart' && !intent.entities.quantity) {
              intent.entities.quantity = 1; // Default to 1
            }
          }
        }
        continue; // Already handled, skip dlmOutput path
      }
      
      // Fallback: use dlmOutput if available and SKU not already set
      if (dlmOutput && dlmOutput.numbers && !intent.entities.sku) {
        // Find the first number that looks like a product position (1-based)
        const productNumber = dlmOutput.numbers.find(n => {
          const num = typeof n === 'number' ? n : parseInt(n, 10);
          return num >= 1 && num <= this.conversationContext.lastProducts.length;
        });
        
        if (productNumber) {
          const index = typeof productNumber === 'number' ? productNumber : parseInt(productNumber, 10);
          const selectedProduct = this.conversationContext.lastProducts[index - 1];
          
          if (selectedProduct && selectedProduct.sku) {
            console.log(`[ShopPilot] Resolved product number ${index} to SKU: ${selectedProduct.sku}`);
            
            // Update entities with the actual SKU
            intent.entities.sku = selectedProduct.sku;
            intent.entities.product = selectedProduct.name || selectedProduct.title;
            
            // For add_to_cart, preserve quantity if it's different from the product number
            if (intent.name === 'add_to_cart' && !intent.entities.quantity) {
              intent.entities.quantity = 1; // Default to 1
            }
          }
        }
      }
    }
  }

  /**
   * Check if a value is a product position number (1, 2, 3) vs a SKU code
   * @param {string} value - The value to check
   * @returns {boolean} True if it's a simple position number
   */
  isProductPosition(value) {
    if (!value) return false;
    // If it's a simple 1-2 digit number, it's likely a position
    // If it contains letters or is a longer number, it's likely a SKU
    const str = String(value);
    return /^\d{1,2}$/.test(str);
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
   * Clear product context
   * Call this when starting a new conversation flow or after timeout
   */
  clearProductContext() {
    this.conversationContext.lastProducts = [];
    this.conversationContext.lastIntent = null;
    this.conversationContext.contextTimestamp = null;
    console.log('[ShopPilot] Product context cleared');
  }

  /**
   * Check if product context has expired (older than 5 minutes)
   */
  isContextExpired() {
    if (!this.conversationContext.contextTimestamp) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - this.conversationContext.contextTimestamp > fiveMinutes;
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
      'remove_from_cart': 'Remove from cart',
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
