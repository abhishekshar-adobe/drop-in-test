/**
 * Cockpit UI Block
 * AI-powered admin interface for managing orders, returns, and payments
 */

// Import compromise.js for NLP parsing
import nlp from 'https://cdn.jsdelivr.net/npm/compromise@14.14.0/+esm';
// Import Fuse.js for fuzzy matching
import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs';

export default async function decorate(block) {
  // Create the main cockpit container
  const cockpitContainer = document.createElement("div");
  cockpitContainer.classList.add("cockpit-container");

  // Create header
  const header = document.createElement("div");
  header.classList.add("cockpit-header");
  header.innerHTML = `
    <h1>Cockpit AI Assistant</h1>
    <p>Manage your orders, returns, and payments with AI</p>
  `;

  // Create chat interface
  const chatInterface = document.createElement("div");
  chatInterface.classList.add("cockpit-chat");
  chatInterface.innerHTML = `
    <div class="chat-messages" id="chat-messages">
      <div class="message assistant">
        <div class="message-content">
          <p>👋 Hello! I'm your AI assistant. I can help you with:</p>
          <ul>
            <li>� Searching for products</li>
            <li>�📦 Managing orders</li>
            <li>↩️ Processing returns</li>
            <li>💳 Handling payments</li>
            <li>🛒 Adding items to cart</li>
            <li>❤️ Adding items to wishlist</li>
          </ul>
          <p>What would you like to do today?</p>
        </div>
      </div>
    </div>
    <div class="chat-input-container">
      <input 
        type="text" 
        id="chat-input" 
        class="chat-input" 
        placeholder="Ask me anything... (e.g., 'Show me recent orders')"
      />
      <button id="chat-send" class="chat-send-btn">Send</button>
    </div>
  `;

  // Create action cards
  const actionCards = document.createElement("div");
  actionCards.classList.add("cockpit-actions");
  actionCards.innerHTML = `
    <div class="action-card" data-action="search">
      <div class="card-icon">🔍</div>
      <h3>Search</h3>
      <p>Search for products</p>
    </div>
    <div class="action-card" data-action="orders">
      <div class="card-icon">📦</div>
      <h3>Orders</h3>
      <p>View and manage customer orders</p>
    </div>
    <div class="action-card" data-action="returns">
      <div class="card-icon">↩️</div>
      <h3>Returns</h3>
      <p>Process return requests</p>
    </div>
    <div class="action-card" data-action="payments">
      <div class="card-icon">💳</div>
      <h3>Payments</h3>
      <p>Handle payment transactions</p>
    </div>
    <div class="action-card" data-action="wishlist">
      <div class="card-icon">❤️</div>
      <h3>Wishlist</h3>
      <p>Manage wishlist items</p>
    </div>
  `;

  // Assemble the cockpit
  cockpitContainer.appendChild(header);
  cockpitContainer.appendChild(chatInterface);
  cockpitContainer.appendChild(actionCards);

  // Clear and append to block
  block.textContent = "";
  block.appendChild(cockpitContainer);

  // Initialize event listeners
  initializeCockpit();
}

/**
 * Initialize cockpit functionality
 */
function initializeCockpit() {
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  const chatMessages = document.getElementById("chat-messages");
  const actionCards = document.querySelectorAll(".action-card");

  // Create a persistent agent instance
  const agent = new CockpitAgent();
  window.cockpitAgent = agent; // Store globally for access

  // Handle send button click
  if (chatSend) {
    chatSend.addEventListener("click", () =>
      handleSendMessage(chatInput, chatMessages, agent)
    );
  }

  // Handle enter key in input
  if (chatInput) {
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSendMessage(chatInput, chatMessages, agent);
      }
    });
  }

  // Handle action card clicks
  actionCards.forEach((card) => {
    card.addEventListener("click", () => {
      const { action } = card.dataset;
      handleActionCard(action, chatMessages, agent);
    });
  });
}

/**
 * LangGraph-inspired Agent State Machine
 * Simplified version that works in browser without external dependencies
 */
class CockpitAgent {
  constructor() {
    this.state = {
      messages: [],
      intent: null,
      action: null,
      result: null,
    };
    this.lastSearchResults = null;
    this.pendingProduct = null; // Store product awaiting option selection
    
    // Conversation context for multi-turn dialogs
    this.conversationContext = {
      awaitingSlots: false,
      currentIntent: null,
      collectedSlots: {},
      missingSlots: [],
      originalMessage: null
    };
    
    // Initialize Fuse.js with known slot values for fuzzy matching
    this.initializeFuzzyMatchers();
  }

  /**
   * Define required slots for each intent type
   */
  getRequiredSlots(intentType) {
    const requiredSlotsMap = {
      'product_search': ['query'],
      'add_to_cart': ['sku'],
      'add_to_wishlist': ['sku'],
      'select_product_by_number': ['index'],
      'select_product_options': ['selections']
    };
    
    return requiredSlotsMap[intentType] || [];
  }

  /**
   * Check if all required slots are present
   */
  validateSlots(intent, entities) {
    const requiredSlots = this.getRequiredSlots(intent.type);
    const missingSlots = [];
    
    for (const slot of requiredSlots) {
      const value = entities[slot];
      
      // Check if slot is missing, empty, or invalid
      if (!value || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        missingSlots.push(slot);
      }
      // Special validation for 'query' - must be meaningful
      else if (slot === 'query') {
        const queryStr = String(value).trim().toLowerCase();
        // Query is invalid if it's too short or just a stop word
        if (queryStr.length < 2 || (this.stopWords && this.stopWords.has(queryStr))) {
          missingSlots.push(slot);
        }
      }
    }
    
    return {
      isValid: missingSlots.length === 0,
      missingSlots
    };
  }

  /**
   * Generate follow-up question for missing slots
   */
  generateFollowUpQuestion(intent, missingSlots) {
    const slotQuestions = {
      'query': 'What would you like to search for?',
      'sku': 'Which product would you like to add? Please provide a SKU or search for a product first.',
      'quantity': 'How many items would you like?',
      'size': 'What size would you like?',
      'color': 'What color would you prefer?',
      'index': 'Please enter the number of the product you want to select.',
      'selections': 'Please provide your option selections.'
    };

    const questions = missingSlots.map(slot => slotQuestions[slot] || `Please provide: ${slot}`);
    
    // Add context-specific guidance
    let guidance = '';
    if (intent.type === 'add_to_cart' || intent.type === 'add_to_wishlist') {
      guidance = '\n\n💡 Tip: You can search for a product first, then select it by number.';
    }
    
    return `❓ ${questions.join(' ')}${guidance}`;
  }

  /**
   * Merge slots from follow-up response with collected slots
   */
  mergeSlots(collectedSlots, newSlots) {
    return { ...collectedSlots, ...newSlots };
  }

  /**
   * Initialize Fuse.js fuzzy matchers for known slot values
   * Handles typo correction for sizes, colors, and other attributes
   */
  initializeFuzzyMatchers() {
    // Stop words - common words that should never be fuzzy matched
    this.stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'for', 'with', 'to', 'of', 'in', 'on', 'at',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'can', 'not', 'no', 'yes', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'us', 'them',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
      'search', 'find', 'add', 'show', 'get', 'want', 'need', 'like', 'item', 'product'
    ]);

    // Known size values
    this.knownSizes = [
      'xs', 'extra small',
      's', 'small',
      'm', 'medium',
      'l', 'large',
      'xl', 'extra large',
      'xxl', 'extra extra large',
      '2xl', '3xl', '4xl'
    ];

    // Known color values
    this.knownColors = [
      'black', 'white', 'gray', 'grey',
      'red', 'blue', 'green', 'yellow',
      'orange', 'purple', 'pink', 'brown',
      'navy', 'beige', 'tan', 'khaki',
      'silver', 'gold', 'maroon', 'olive'
    ];

    // Known material values
    this.knownMaterials = [
      'cotton', 'polyester', 'wool', 'silk',
      'leather', 'denim', 'linen', 'nylon',
      'spandex', 'rayon', 'cashmere'
    ];

    // Configure Fuse.js options for fuzzy matching
    const fuseOptions = {
      threshold: 0.3, // More strict: 0.4 → 0.3 (lower = more strict)
      distance: 100,
      includeScore: true,
      minMatchCharLength: 3 // Require at least 3 characters
    };

    // Create Fuse instances for each slot type
    this.sizeFuse = new Fuse(this.knownSizes, fuseOptions);
    this.colorFuse = new Fuse(this.knownColors, fuseOptions);
    this.materialFuse = new Fuse(this.knownMaterials, fuseOptions);
  }

  /**
   * Correct typos in user input using fuzzy matching
   * Examples: "larg" → "large", "meduim" → "medium"
   */
  correctSlotValue(value, slotType) {
    if (!value || typeof value !== 'string') return value;

    const normalizedValue = value.toLowerCase().trim();
    
    // Skip stop words - prevent false positives like "for" → "orange"
    if (this.stopWords.has(normalizedValue)) {
      return value;
    }
    
    // Skip very short words (< 3 chars) unless it's a known size abbreviation
    if (normalizedValue.length < 3 && slotType !== 'size') {
      return value;
    }
    
    let fuse;
    let knownValues;

    // Select appropriate fuzzy matcher based on slot type
    switch (slotType) {
      case 'size':
        fuse = this.sizeFuse;
        knownValues = this.knownSizes;
        break;
      case 'color':
        fuse = this.colorFuse;
        knownValues = this.knownColors;
        break;
      case 'material':
        fuse = this.materialFuse;
        knownValues = this.knownMaterials;
        break;
      default:
        return value; // No correction for unknown slot types
    }

    // Check for exact match first (case-insensitive)
    if (knownValues.includes(normalizedValue)) {
      return normalizedValue;
    }

    // Perform fuzzy search
    const results = fuse.search(normalizedValue);

    // More strict validation:
    // 1. Must have at least one result
    // 2. Score must be < 0.3 (more strict than before)
    // 3. Must have at least 50% character overlap
    if (results.length > 0 && results[0].score < 0.3) {
      const correctedValue = results[0].item;
      const similarity = this.calculateSimilarity(normalizedValue, correctedValue);
      
      // Only accept if similarity is high enough
      if (similarity >= 0.5) {
        console.log(`Fuzzy match correction: "${value}" → "${correctedValue}" (confidence: ${(1 - results[0].score).toFixed(2)}, similarity: ${similarity.toFixed(2)})`);
        return correctedValue;
      }
    }

    // No good match found, return original value
    return value;
  }

  /**
   * Calculate character-level similarity between two strings
   * Returns a value between 0 and 1
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    // Count matching characters
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) {
        matches++;
      }
    }
    
    return matches / longer.length;
  }

  /**
   * Extract and correct slot values from text
   * Applies fuzzy matching to known attributes
   */
  extractAndCorrectSlots(text, nlpData) {
    const slots = {
      size: null,
      color: null,
      material: null
    };

    const words = text.toLowerCase().split(/\s+/);

    // Extract and correct size
    const sizeKeywords = ['size', 'sized'];
    for (let i = 0; i < words.length; i++) {
      if (sizeKeywords.some(kw => words[i].includes(kw)) && i + 1 < words.length) {
        slots.size = this.correctSlotValue(words[i + 1], 'size');
      } else if (this.knownSizes.some(s => words[i].includes(s))) {
        // Check if word is similar to a known size
        const corrected = this.correctSlotValue(words[i], 'size');
        if (corrected !== words[i]) {
          slots.size = corrected;
        }
      }
    }

    // Extract and correct color
    const colorKeywords = ['color', 'colour'];
    for (let i = 0; i < words.length; i++) {
      if (colorKeywords.some(kw => words[i].includes(kw)) && i + 1 < words.length) {
        slots.color = this.correctSlotValue(words[i + 1], 'color');
      } else {
        // Try fuzzy matching against known colors
        const corrected = this.correctSlotValue(words[i], 'color');
        if (corrected !== words[i] && this.knownColors.includes(corrected)) {
          slots.color = corrected;
        }
      }
    }

    // Extract and correct material
    for (const word of words) {
      const corrected = this.correctSlotValue(word, 'material');
      if (corrected !== word && this.knownMaterials.includes(corrected)) {
        slots.material = corrected;
      }
    }

    return slots;
  }

  /**
   * Main conversation processing flow
   * 
   * Flow Diagram:
   * =============
   * User Input
   *    ↓
   * Parse (compromise.js) ← Extract verbs, nouns, numbers, POS tagging
   *    ↓
   * Fuzzy Correction (Fuse.js) ← Correct typos: "larg" → "large", "meduim" → "medium"
   *    ↓
   * Detect Intent ← Determine user's goal (search, add to cart, etc.)
   *    ↓
   * Extract Slots ← Identify entities (SKU, size, color, quantity)
   *    ↓
   * Are all required slots present?
   *    ├─ NO → Ask follow-up question (store context for next turn)
   *    └─ YES → Execute ecommerce action
   * 
   * Multi-turn Example:
   * -------------------
   * User: "add to cart"
   * Bot: "❓ Which product would you like to add? Please provide a SKU or search for a product first."
   * User: "MH01"
   * Bot: "✅ Successfully added 1 item(s) with SKU MH01 to cart!"
   */
  async process(userMessage) {
    this.state.messages.push(userMessage);

    // ============================================
    // STRUCTURED CONVERSATION FLOW
    // ============================================
    
    // Step 1: Parse with compromise.js
    const nlpData = this.parseWithNLP(userMessage);
    console.log('📝 Step 1 - Parse:', { verbs: nlpData.verbs, nouns: nlpData.nouns });

    // Step 2: Fuzzy Correction with Fuse.js
    const correctedSlots = this.extractAndCorrectSlots(userMessage.toLowerCase(), nlpData);
    console.log('🔧 Step 2 - Fuzzy Correction:', correctedSlots);

    // Check if we're in the middle of collecting slots
    if (this.conversationContext.awaitingSlots) {
      console.log('🔄 Continuing slot collection for:', this.conversationContext.currentIntent.type);
      
      // Handle follow-up responses based on missing slots
      const missingSlots = this.conversationContext.missingSlots;
      const currentIntent = this.conversationContext.currentIntent;
      
      // Directly fill missing slots from user response
      if (missingSlots.includes('query')) {
        // User is providing a search query
        this.conversationContext.collectedSlots.query = userMessage.trim();
        console.log('📝 Filled query slot with:', userMessage.trim());
      } else if (missingSlots.includes('sku')) {
        // User is providing a SKU
        const cleanSku = userMessage.trim().toUpperCase();
        this.conversationContext.collectedSlots.sku = cleanSku;
        console.log('📝 Filled SKU slot with:', cleanSku);
      } else {
        // For other cases, re-analyze the message
        const followUpIntent = this.analyzeIntent(userMessage);
        this.conversationContext.collectedSlots = this.mergeSlots(
          this.conversationContext.collectedSlots,
          followUpIntent.entities
        );
      }
      
      // Use the original intent type but with updated entities
      this.state.intent = {
        type: currentIntent.type,
        entities: this.conversationContext.collectedSlots
      };
    } else {
      // Step 3: Detect Intent
      this.state.intent = this.analyzeIntent(userMessage);
      console.log('🎯 Step 3 - Detect Intent:', this.state.intent.type);
    }

    // Step 4: Extract Slots (already done in analyzeIntent)
    console.log('📦 Step 4 - Extract Slots:', this.state.intent.entities);

    // Step 5: Validate - Are all required slots present?
    const validation = this.validateSlots(this.state.intent, this.state.intent.entities);
    console.log('✅ Step 5 - Validate Slots:', validation);

    if (!validation.isValid) {
      // NO → Ask follow-up question
      console.log('❌ Missing slots:', validation.missingSlots);
      
      // Store conversation context
      this.conversationContext = {
        awaitingSlots: true,
        currentIntent: this.state.intent,
        collectedSlots: this.state.intent.entities,
        missingSlots: validation.missingSlots,
        originalMessage: userMessage
      };
      
      const followUpQuestion = this.generateFollowUpQuestion(
        this.state.intent,
        validation.missingSlots
      );
      
      this.state.messages.push(followUpQuestion);
      return followUpQuestion;
    }

    // YES → Execute ecommerce action
    console.log('✅ All required slots present, executing action...');
    
    // Clear conversation context
    this.conversationContext = {
      awaitingSlots: false,
      currentIntent: null,
      collectedSlots: {},
      missingSlots: [],
      originalMessage: null
    };

    // Step 6: Execute Action
    this.state.result = await this.executeAction(this.state.intent);

    // Step 7: Format Response
    const response = this.formatResponse(this.state.intent, this.state.result);
    this.state.messages.push(response);

    return response;
  }

  /**
   * Parse text using compromise.js for NLP analysis
   * Extracts verbs, nouns, numbers, and POS tagging
   */
  parseWithNLP(text) {
    const doc = nlp(text);
    
    return {
      // Extract verbs for intent signals (add, search, return, show, find)
      verbs: doc.verbs().out('array'),
      // Extract nouns for entities (product, order, cart, wishlist)
      nouns: doc.nouns().out('array'),
      // Extract numbers (quantities: 1, 5, 10)
      numbers: doc.numbers().out('array'),
      // Extract ordinals (first, second, third, 1st, 2nd)
      ordinals: doc.numbers().filter(num => num.has('#Ordinal')).out('array'),
      // Extract values for numbers (converts "two" to 2)
      numericValues: doc.numbers().toNumber().out('array'),
      // Get all terms
      terms: doc.terms().out('array'),
      // Full document for further analysis
      doc
    };
  }

  /**
   * Extract quantity from text using NLP
   * Handles: "add 5 items", "two products", "second item"
   */
  extractQuantity(nlpData, text) {
    // Check for explicit numbers first
    if (nlpData.numericValues && nlpData.numericValues.length > 0) {
      return nlpData.numericValues[0];
    }
    
    // Check for ordinals (first = 1, second = 2, etc.)
    if (nlpData.ordinals && nlpData.ordinals.length > 0) {
      const ordinal = nlpData.ordinals[0].toLowerCase();
      const ordinalMap = {
        'first': 1, '1st': 1,
        'second': 2, '2nd': 2,
        'third': 3, '3rd': 3,
        'fourth': 4, '4th': 4,
        'fifth': 5, '5th': 5
      };
      return ordinalMap[ordinal] || 1;
    }
    
    // Default quantity
    return 1;
  }

  /**
   * Detect intent type using NLP verb analysis
   */
  detectIntentFromVerbs(nlpData) {
    const verbs = nlpData.verbs.map(v => v.toLowerCase());
    
    // Intent mapping based on verbs
    const intentMap = {
      search: ['search', 'find', 'look', 'show'],
      add_to_cart: ['add', 'put', 'place'],
      add_to_wishlist: ['save', 'bookmark', 'wishlist'],
      return: ['return', 'refund'],
      show_orders: ['show', 'display', 'list', 'view'],
      order: ['order', 'purchase', 'buy'],
      payment: ['pay', 'payment']
    };
    
    for (const [intent, verbList] of Object.entries(intentMap)) {
      if (verbs.some(verb => verbList.includes(verb))) {
        return intent;
      }
    }
    
    return null;
  }

  /**
   * Analyze intent using scoring system
   * 
   * Flow:
   * 1. Context check (awaiting slot?)
   * 2. Verb + keyword signals (compromise)
   * 3. Intent scoring (not boolean)
   * 4. Conflict resolution
   * 5. Intent selected or clarification
   */
  analyzeIntent(message) {
    const text = message.toLowerCase();
    
    // Step 1: Parse message with compromise.js for NLP analysis
    const nlpData = this.parseWithNLP(message);
    
    // Extract and correct slot values using Fuse.js
    const slots = this.extractAndCorrectSlots(text, nlpData);
    
    console.log('🔍 NLP Analysis:', {
      verbs: nlpData.verbs,
      nouns: nlpData.nouns,
      numbers: nlpData.numbers,
      numericValues: nlpData.numericValues,
      correctedSlots: slots
    });

    // Step 2: Context check - Handle special context-dependent cases first
    
    // Check if user is providing option selections (e.g., "1,2" or "1, 2")
    if (this.pendingProduct) {
      const optionMatch = text.match(/^[\d,\s]+$/);
      if (optionMatch) {
        const selections = text.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (selections.length > 0) {
          return { type: "select_product_options", entities: { selections }, confidence: 1.0 };
        }
      }
    }

    // Check if user is selecting a product by number using NLP
    if (this.lastSearchResults) {
      // Check for ordinals (first, second) or numbers (1, 2)
      if (nlpData.numericValues.length > 0) {
        const index = nlpData.numericValues[0] - 1;
        if (index >= 0 && index < this.lastSearchResults.length) {
          return { type: "select_product_by_number", entities: { index }, confidence: 1.0 };
        }
      }
    }

    // Step 3: Extract verb + keyword signals
    const signals = this.extractIntentSignals(text, nlpData);
    console.log('📊 Intent Signals:', signals);
    
    // Step 4: Score all intents
    const intentScores = this.scoreIntents(signals, nlpData);
    console.log('🎯 Intent Scores:', intentScores);
    
    // Step 5: Select best intent or handle conflicts
    const result = this.selectBestIntent(intentScores, signals, nlpData, message, slots);
    console.log('✅ Selected Intent:', result);
    
    return result;
  }

  /**
   * Extract signals from text for intent scoring
   */
  extractIntentSignals(text, nlpData) {
    const verbs = nlpData.verbs.map(v => v.toLowerCase());
    const nouns = nlpData.nouns.map(n => n.toLowerCase());
    const terms = nlpData.terms.map(t => t.toLowerCase());
    
    return {
      // Action verbs
      hasSearch: verbs.some(v => ['search', 'find', 'look'].includes(v)),
      hasAdd: verbs.some(v => ['add', 'put', 'place'].includes(v)),
      hasShow: verbs.some(v => ['show', 'display', 'list', 'view', 'get'].includes(v)),
      hasReturn: verbs.some(v => ['return', 'refund'].includes(v)),
      hasPay: verbs.some(v => ['pay', 'payment'].includes(v)),
      
      // Target nouns
      hasProduct: nouns.some(n => ['product', 'item', 'thing'].includes(n)),
      hasOrder: nouns.some(n => n.includes('order')),
      hasCart: nouns.some(n => n.includes('cart')),
      hasWishlist: nouns.some(n => n.includes('wishlist')),
      hasPayment: nouns.some(n => n.includes('payment')),
      hasReturn: nouns.some(n => n.includes('return')),
      
      // Compound phrases
      hasRecentOrder: text.includes('recent order') || text.includes('past order'),
      hasOrderHistory: text.includes('order history') || text.includes('my order'),
      hasAddToCart: text.includes('add to cart') || text.includes('add product'),
      hasAddToWishlist: text.includes('add to wishlist') || text.includes('wishlist'),
      hasSearchFor: text.includes('search for') || text.includes('find'),
      hasLookFor: text.includes('look for'),
      
      // Context
      verbs,
      nouns,
      terms,
      hasNumbers: nlpData.numericValues.length > 0
    };
  }

  /**
   * Score each intent based on signals
   * Returns object with intent types and their confidence scores (0-1)
   */
  scoreIntents(signals, nlpData) {
    const scores = {
      product_search: 0,
      show_orders: 0,
      add_to_cart: 0,
      add_to_wishlist: 0,
      orders: 0,
      returns: 0,
      payments: 0
    };
    
    // Product Search Scoring
    if (signals.hasSearchFor) scores.product_search += 0.6;
    if (signals.hasSearch) scores.product_search += 0.3;
    if (signals.hasLookFor && !signals.hasOrder) scores.product_search += 0.4;
    if (signals.hasProduct) scores.product_search += 0.2;
    if (!signals.hasOrder && !signals.hasCart && !signals.hasWishlist) {
      scores.product_search += 0.1; // Slight boost if not explicitly cart/order related
    }
    
    // Show Orders Scoring (specific order viewing)
    if (signals.hasRecentOrder) scores.show_orders += 0.7;
    if (signals.hasOrderHistory) scores.show_orders += 0.7;
    if (signals.hasShow && signals.hasOrder) scores.show_orders += 0.5;
    if (signals.hasOrder && signals.verbs.some(v => ['show', 'get', 'view', 'display'].includes(v))) {
      scores.show_orders += 0.4;
    }
    
    // Add to Cart Scoring
    if (signals.hasAddToCart) scores.add_to_cart += 0.8;
    if (signals.hasAdd && signals.hasCart) scores.add_to_cart += 0.6;
    if (signals.hasAdd && signals.hasProduct) scores.add_to_cart += 0.3;
    
    // Add to Wishlist Scoring
    if (signals.hasAddToWishlist) scores.add_to_wishlist += 0.8;
    if (signals.hasWishlist) scores.add_to_wishlist += 0.5;
    if (signals.hasAdd && signals.hasWishlist) scores.add_to_wishlist += 0.6;
    
    // Orders (general) Scoring
    if (signals.hasOrder && !signals.hasShow) scores.orders += 0.3;
    if (signals.hasOrder) scores.orders += 0.2;
    
    // Returns Scoring
    if (signals.hasReturn) scores.returns += 0.6;
    if (signals.nouns.some(n => n.includes('return'))) scores.returns += 0.3;
    
    // Payments Scoring
    if (signals.hasPay) scores.payments += 0.6;
    if (signals.hasPayment) scores.payments += 0.5;
    
    // Normalize scores to 0-1 range
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 1) {
      Object.keys(scores).forEach(key => {
        scores[key] = Math.min(scores[key] / maxScore, 1.0);
      });
    }
    
    return scores;
  }

  /**
   * Select best intent from scores with conflict resolution
   */
  selectBestIntent(scores, signals, nlpData, message, slots) {
    // Sort intents by score
    const sortedIntents = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .filter(([, score]) => score > 0);
    
    if (sortedIntents.length === 0) {
      return { type: "general", entities: {}, confidence: 0 };
    }
    
    const [topIntent, topScore] = sortedIntents[0];
    const [secondIntent, secondScore] = sortedIntents[1] || [null, 0];
    
    // Conflict threshold - if top two intents are within 0.2 of each other, it's ambiguous
    const CONFLICT_THRESHOLD = 0.2;
    const hasConflict = secondScore > 0 && (topScore - secondScore) < CONFLICT_THRESHOLD;
    
    console.log(`🎯 Top: ${topIntent} (${topScore.toFixed(2)}), Second: ${secondIntent} (${secondScore.toFixed(2)})`);
    
    // If there's a conflict and both scores are significant (> 0.4), ask for clarification
    if (hasConflict && topScore > 0.4 && secondScore > 0.4) {
      console.log('⚠️ Intent conflict detected, may need clarification');
      // For now, still pick the top intent but with lower confidence
      // In future, we could ask: "Did you mean to [top] or [second]?"
    }
    
    // Extract entities based on selected intent
    const quantity = this.extractQuantity(nlpData, message);
    let entities = {};
    
    switch (topIntent) {
      case 'product_search':
        entities = this.extractSearchQuery(message);
        entities.slots = slots;
        break;
        
      case 'add_to_cart':
      case 'add_to_wishlist':
        entities = this.extractCartEntities(message, nlpData, quantity);
        entities.slots = slots;
        break;
        
      case 'show_orders':
      case 'orders':
      case 'returns':
      case 'payments':
        entities = {};
        break;
        
      default:
        entities = {};
    }
    
    return {
      type: topIntent,
      entities,
      confidence: topScore,
      alternativeIntent: secondIntent ? { type: secondIntent, confidence: secondScore } : null
    };
  }

  extractCartEntities(text, nlpData = null, quantity = null) {
    // Use NLP-extracted quantity if available, otherwise parse manually
    let extractedQuantity = quantity;
    
    if (!extractedQuantity && nlpData) {
      extractedQuantity = this.extractQuantity(nlpData, text);
    }
    
    // Fallback to regex if NLP didn't find quantity
    if (!extractedQuantity) {
      const quantityMatch = text.match(/(\d+)\s*(item|product|unit)/i);
      extractedQuantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
    }
    
    // Extract SKU - try multiple patterns
    let sku = null;
    const skuMatch = text.match(/sku[:\s]+([A-Z0-9-]+)/i);
    if (skuMatch) {
      sku = skuMatch[1].toUpperCase();
    } else {
      // Check if entire text is SKU-like (follow-up response)
      const cleanText = text.trim().toUpperCase();
      if (/^[A-Z0-9-]{2,}$/.test(cleanText)) {
        sku = cleanText;
      }
    }

    return {
      sku: sku || '', // Don't default to MH01, let validation handle missing SKU
      quantity: extractedQuantity,
    };
  }

  extractSearchQuery(text) {
    // Extract search query from message
    const searchPatterns = [
      /search\s+(?:for\s+)?["']?([^"']+)["']?/i,
      /find\s+(?:me\s+)?["']?([^"']+)["']?/i,
      /look\s+for\s+["']?([^"']+)["']?/i,
    ];

    for (const pattern of searchPatterns) {
      const match = text.match(pattern);
      if (match) {
        const extractedQuery = match[1].trim();
        
        // Filter out if the query is just "for" or other stop words
        if (this.stopWords && this.stopWords.has(extractedQuery.toLowerCase())) {
          return { query: "" };
        }
        
        // Filter out very short queries (< 2 chars)
        if (extractedQuery.length < 2) {
          return { query: "" };
        }
        
        return { query: extractedQuery };
      }
    }

    // Check if message is just the query itself (follow-up case)
    const text_lower = text.toLowerCase();
    if (!text_lower.includes('search') && !text_lower.includes('find') && 
        !text_lower.includes('look') && text.length > 2) {
      // Likely a follow-up response with just the query
      // But still filter out stop words
      if (this.stopWords && !this.stopWords.has(text_lower)) {
        return { query: text.trim() };
      }
    }

    // If no pattern matches, return empty query
    return { query: "" };
  }

  async executeAction(intent) {
    try {
      switch (intent.type) {
        case "product_search":
          return await this.handleProductSearch(intent.entities);

        case "select_product_by_number":
          return await this.handleSelectProductByNumber(intent.entities);

        case "select_product_options":
          return await this.handleSelectProductOptions(intent.entities);

        case "add_to_cart":
          return await this.handleAddToCart(intent.entities);

        case "add_to_wishlist":
          return await this.handleAddToWishlist(intent.entities);

        case "show_orders":
          return await this.handleShowOrders();

        case "orders":
          return await this.handleOrders();

        case "returns":
          return await this.handleReturns();

        case "payments":
          return await this.handlePayments();

        default:
          return {
            success: true,
            message:
              "I can help with searching products, orders, returns, payments, adding products to cart, and managing your wishlist.",
          };
      }
    } catch (error) {
      console.error("Action execution error:", error);
      return { success: false, error: error.message };
    }
  }

  async handleProductSearch(entities) {
    try {
      const { query, slots } = entities;

      if (!query) {
        return {
          success: false,
          message: "Please provide a search query. Example: 'search for shirts'",
        };
      }

      // Build enhanced query with corrected slot values
      let enhancedQuery = query;
      const slotMessages = [];
      
      if (slots) {
        if (slots.size) {
          enhancedQuery += ` ${slots.size}`;
          slotMessages.push(`size: ${slots.size}`);
        }
        if (slots.color) {
          enhancedQuery += ` ${slots.color}`;
          slotMessages.push(`color: ${slots.color}`);
        }
        if (slots.material) {
          enhancedQuery += ` ${slots.material}`;
          slotMessages.push(`material: ${slots.material}`);
        }
      }

      console.log("Searching for:", enhancedQuery);
      if (slotMessages.length > 0) {
        console.log("Applied corrections:", slotMessages.join(", "));
      }

      // Import required utilities and API
      const { getHeaders } = await import("@dropins/tools/lib/aem/configs.js");
      const { commerceEndpointWithQueryParams } = await import("../../scripts/commerce.js");
      const productDiscoveryApi = await import("@dropins/storefront-product-discovery/api.js");

      // Initialize the API with proper headers and endpoint
      try {
        const endpoint = await commerceEndpointWithQueryParams();
        productDiscoveryApi.setEndpoint(endpoint);
        productDiscoveryApi.setFetchGraphQlHeaders((prev) => ({ ...prev, ...getHeaders('cs') }));
        console.log("Product discovery API initialized with endpoint:", endpoint);
      } catch (initError) {
        console.warn("API initialization warning:", initError);
      }

      // Perform product search with proper parameters
      const searchParams = {
        phrase: enhancedQuery,
        pageSize: 5,
        currentPage: 1,
      };

      console.log("Search params:", searchParams);

      const result = await productDiscoveryApi.productSearch(searchParams);

      console.log("Search result:", result);
      console.log("Result structure:", JSON.stringify(result, null, 2));

      // Handle the response - the API returns { productSearch: { ... } }
      const searchData = result?.productSearch || result;
      const items = searchData?.items || [];
      const totalCount = searchData?.total_count || 0;

      console.log("Extracted items:", items.length, "Total count:", totalCount);

      if (items && items.length > 0) {
        // Store search results for numeric selection
        this.lastSearchResults = items.slice(0, 5).map(item => item.productView);

        // Create HTML product cards with numbers
        const productCards = this.lastSearchResults.map((product, index) => {
          const number = index + 1;
          
          // Get first image
          const imageUrl = product.images?.[0]?.url || "";
          
          // Extract price based on product type
          let priceText = "";
          if (product.__typename === "ComplexProductView" && product.priceRange) {
            const minPrice = product.priceRange.minimum.final.amount.value;
            const maxPrice = product.priceRange.maximum.final.amount.value;
            
            if (minPrice === maxPrice) {
              priceText = `$${minPrice.toFixed(2)}`;
            } else {
              priceText = `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
            }
          } else if (product.price) {
            const price = product.price.final.amount.value;
            const regularPrice = product.price.regular.amount.value;
            
            if (price < regularPrice) {
              priceText = `<span class="sale-price">$${price.toFixed(2)}</span> <del>$${regularPrice.toFixed(2)}</del>`;
            } else {
              priceText = `$${price.toFixed(2)}`;
            }
          }
          
          return `
            <div class="product-card" data-sku="${product.sku}">
              <div class="product-number">${number}</div>
              <div class="product-image">
                ${imageUrl ? `<img src="${imageUrl}" alt="${product.name}" />` : '<div class="no-image">No Image</div>'}
              </div>
              <div class="product-info">
                <h4 class="product-name">${product.name}</h4>
                <p class="product-sku">SKU: ${product.sku}</p>
                <p class="product-price">${priceText}</p>
              </div>
            </div>
          `;
        }).join("");

        // Build search header with corrected slots info
        let searchHeader = `🔍 Found ${totalCount} products matching "${query}"`;
        if (slotMessages.length > 0) {
          searchHeader += ` <span class="slot-corrections">(Applied corrections: ${slotMessages.join(", ")})</span>`;
        }

        return {
          success: true,
          message: `<div class="search-header">${searchHeader}</div><div class="product-grid">${productCards}</div><div class="selection-prompt">💬 Enter a number (1-5) to add that product to your cart</div>`,
          isHtml: true,
        };
      }

      return {
        success: true,
        message: `🔍 No products found for "${query}". Try a different search term.`,
      };
    } catch (error) {
      console.error("Product search error details:", error);
      console.error("Error stack:", error.stack);
      
      // More detailed error message
      let errorMsg = error.message || "Unknown error";
      if (error.message?.includes("500")) {
        errorMsg = "Server error (500). Please check console for details.";
      }
      
      return {
        success: false,
        message: `❌ Search failed: ${errorMsg}`,
      };
    }
  }

  async handleSelectProductByNumber(entities) {
    try {
      const { index } = entities;
      const product = this.lastSearchResults[index];

      if (!product) {
        return {
          success: false,
          message: "❌ Invalid product selection. Please try again.",
        };
      }

      // Import the cart dropin
      const cartApi = await import("@dropins/storefront-cart/api.js");

      // Add product to cart with just SKU and quantity
      const result = await cartApi.addProductsToCart([
        {
          sku: product.sku,
          quantity: 1,
        },
      ]);

      console.log("Add to cart result:", result);

      // Clear search results after adding
      this.lastSearchResults = null;

      return {
        success: true,
        message: `✅ Successfully added "${product.name}" (SKU: ${product.sku}) to cart!`,
        data: result,
      };
    } catch (error) {
      console.error("Add to cart by number error:", error);
      return {
        success: false,
        message: `❌ Failed to add to cart: ${error.message}`,
      };
    }
  }

  async handleSelectProductOptions(entities) {
    try {
      const { selections } = entities;
      const product = this.pendingProduct;

      if (!product) {
        return {
          success: false,
          message: "❌ No product pending option selection. Please search and select a product first.",
        };
      }

      // Build optionUIDs array from selections
      const optionUIDs = [];
      selections.forEach((selectionNum, optionIndex) => {
        const option = product.options[optionIndex];
        if (option && option.values) {
          const valueIndex = selectionNum - 1;
          const selectedValue = option.values[valueIndex];
          if (selectedValue && selectedValue.id) {
            optionUIDs.push(selectedValue.id);
          }
        }
      });

      if (optionUIDs.length === 0) {
        return {
          success: false,
          message: "❌ Invalid option selections. Please try again.",
        };
      }

      // Import the cart dropin
      const cartApi = await import("@dropins/storefront-cart/api.js");

      // Add configurable product with options
      const result = await cartApi.addProductsToCart([
        {
          sku: product.sku,
          quantity: 1,
          optionsUIDs: optionUIDs,
        },
      ]);

      // Clear pending product and search results
      this.pendingProduct = null;
      this.lastSearchResults = null;

      return {
        success: true,
        message: `✅ Successfully added \"${product.name}\" with your selected options to cart!`,
        data: result,
      };
    } catch (error) {
      console.error("Add configurable product error:", error);
      return {
        success: false,
        message: `❌ Failed to add to cart: ${error.message}`,
      };
    }
  }

  async handleAddToCart(entities) {
    try {
      const { sku, quantity } = entities;

      // Import the cart dropin
      const cartApi = await import("@dropins/storefront-cart/api.js");

      // Add products to cart using the dropin
      const result = await cartApi.addProductsToCart([
        {
          sku,
          quantity,
        },
      ]);

      return {
        success: true,
        message: `✅ Successfully added ${quantity} item(s) with SKU ${sku} to cart!`,
        data: result,
      };
    } catch (error) {
      console.error("Add to cart error:", error);
      return {
        success: false,
        message: `❌ Failed to add to cart: ${error.message}`,
      };
    }
  }

  async handleAddToWishlist(entities) {
    try {
      const { sku, quantity } = entities;

      // Import the wishlist dropin
      const wishlistApi = await import("@dropins/storefront-wishlist/api.js");

      // Add products to wishlist using the dropin
      const result = await wishlistApi.addProductsToWishlist([
        {
          sku,
          quantity,
        },
      ]);

      return {
        success: true,
        message: `❤️ Successfully added ${quantity} item(s) with SKU ${sku} to wishlist!`,
        data: result,
      };
    } catch (error) {
      console.error("Add to wishlist error:", error);
      return {
        success: false,
        message: `❌ Failed to add to wishlist: ${error.message}`,
      };
    }
  }

  async handleShowOrders() {
    try {
      // Import the account API which handles CORS and authentication
      const accountApi = await import("@dropins/storefront-account/api.js");

      console.log('📦 Fetching order history from API...');

      // GraphQL query matching the working curl
      const query = `query GET_CUSTOMER_ORDERS_LIST( $currentPage: Int $pageSize: Int $filter: CustomerOrdersFilterInput $sort: CustomerOrderSortInput ) { customer { returns { items { uid number order { id } } } orders( currentPage: $currentPage pageSize: $pageSize filter: $filter sort: $sort ) { page_info { page_size total_pages current_page } date_of_first_order total_count items { token email shipping_method payment_methods { name type } shipping_address { city company country_code firstname lastname postcode region street telephone } billing_address { city company country_code firstname lastname postcode region street telephone } shipments { id number tracking { title number carrier } } number id order_date carrier status items { status product_name id quantity_ordered quantity_shipped quantity_invoiced product { sku url_key small_image { url } } } total { grand_total { value currency } subtotal_incl_tax { currency value } total_tax { currency value } total_shipping { currency value } discounts { amount { currency value } label } } } } } }`;

      // Create date range for last 6 months
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 6);
      
      const variables = {
        pageSize: 10,
        currentPage: 1,
        filter: {
          order_date: {
            from: fromDate.toISOString().split('T')[0],
            to: toDate.toISOString().split('T')[0] + ' 23:59:59'
          }
        },
        sort: {
          sort_direction: 'DESC',
          sort_field: 'CREATED_AT'
        }
      };

      console.log('Making GraphQL request with variables:', JSON.stringify(variables, null, 2));

      // Use the account API's fetchGraphQl which handles CORS and authentication
      const result = await accountApi.fetchGraphQl(query, { variables });

      console.log('✅ Order history response:', result);

      if (!result?.data?.customer?.orders?.items || result.data.customer.orders.items.length === 0) {
        return {
          success: true,
          message: "📦 You don't have any recent orders.",
        };
      }

      const orders = result.data.customer.orders.items;
      const totalCount = result.data.customer.orders.total_count;

      console.log(`Found ${totalCount} orders, displaying first ${Math.min(5, orders.length)}`);

      // Format order history as HTML with enhanced UI
      const orderCards = orders.slice(0, 5).map((order) => {
        const orderNumber = order.number || order.id || 'N/A';
        const orderDate = order.order_date ? new Date(order.order_date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }) : 'N/A';
        const orderStatus = order.status || 'Unknown';
        const statusClass = orderStatus.toLowerCase().replace(/[^a-z]/g, '-');
        const orderTotal = order.total?.grand_total?.value 
          ? `${order.total.grand_total.currency || '$'}${order.total.grand_total.value.toFixed(2)}` 
          : 'N/A';
        const itemCount = order.items?.length || 0;
        const shippingMethod = order.shipping_method || 'Standard Shipping';
        
        // Get first few product images
        const productImages = order.items?.slice(0, 3).map(item => {
          const imgUrl = item.product?.small_image?.url || 'https://via.placeholder.com/60';
          const productName = item.product_name || 'Product';
          return `<img src="${imgUrl}" alt="${productName}" class="order-product-thumb" />`;
        }).join('') || '';
        
        const moreItems = itemCount > 3 ? `<div class="order-more-items">+${itemCount - 3} more</div>` : '';

        // Status badge with icon
        const statusIcons = {
          'processing': '⏳',
          'pending': '🕐',
          'complete': '✅',
          'shipped': '🚚',
          'delivered': '📦',
          'canceled': '❌',
          'refunded': '💰'
        };
        const statusIcon = statusIcons[statusClass] || '📋';

        return `
          <div class="order-card-new">
            <div class="order-card-header">
              <div class="order-number">
                <span class="order-label">Order</span>
                <span class="order-id">#${orderNumber}</span>
              </div>
              <span class="order-status-badge status-${statusClass}">
                <span class="status-icon">${statusIcon}</span>
                <span class="status-text">${orderStatus}</span>
              </span>
            </div>
            
            <div class="order-card-body">
              <div class="order-products">
                <div class="order-product-images">
                  ${productImages}
                  ${moreItems}
                </div>
                <div class="order-item-count">${itemCount} ${itemCount === 1 ? 'item' : 'items'}</div>
              </div>
              
              <div class="order-info-grid">
                <div class="order-info-item">
                  <span class="info-icon">📅</span>
                  <div class="info-content">
                    <span class="info-label">Order Date</span>
                    <span class="info-value">${orderDate}</span>
                  </div>
                </div>
                
                <div class="order-info-item">
                  <span class="info-icon">🚚</span>
                  <div class="info-content">
                    <span class="info-label">Shipping</span>
                    <span class="info-value">${shippingMethod}</span>
                  </div>
                </div>
                
                <div class="order-info-item">
                  <span class="info-icon">💰</span>
                  <div class="info-content">
                    <span class="info-label">Total</span>
                    <span class="info-value order-total">${orderTotal}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="order-card-footer">
              <button class="order-view-btn" onclick="alert('View order #${orderNumber}')">
                View Details
              </button>
              <button class="order-track-btn" onclick="alert('Track order #${orderNumber}')">
                Track Order
              </button>
            </div>
          </div>
        `;
      }).join("");

      return {
        success: true,
        message: `
          <div class="orders-container-new">
            <div class="orders-header-new">
              <h3>📦 Your Recent Orders</h3>
              <span class="orders-count">${totalCount} total orders</span>
            </div>
            <div class="orders-grid-new">${orderCards}</div>
          </div>
        `,
        isHtml: true,
      };

    } catch (error) {
      console.error("Show orders error:", error);
      console.error("Error details:", error.message, error.stack);
      
      return {
        success: false,
        message: `❌ Failed to fetch orders. Please make sure you're logged in and try again.`,
      };
    }
  }

  async handleOrders() {
    // TODO: Connect to real orders API
    return {
      success: true,
      message:
        "📦 I found 3 recent orders. The latest order #12345 is being processed and should ship tomorrow.",
    };
  }

  async handleReturns() {
    // TODO: Connect to real returns API
    return {
      success: true,
      message:
        "↩️ There are 2 pending return requests. Order #12340 - Customer wants to return a shirt (size issue).",
    };
  }

  async handlePayments() {
    // TODO: Connect to real payments API
    return {
      success: true,
      message:
        "💳 Payment summary: 15 successful transactions today totaling $4,532.00. No failed payments.",
    };
  }

  formatResponse(intent, result) {
    if (result.success) {
      return result.message;
    }
    return `⚠️ ${result.message || "Something went wrong. Please try again."}`;
  }
}

/**
 * Handle sending a message
 */
async function handleSendMessage(inputElement, messagesContainer, agent) {
  const message = inputElement.value.trim();

  if (!message) return;

  // Add user message to chat
  addMessage("user", message, messagesContainer);
  // eslint-disable-next-line no-param-reassign
  inputElement.value = "";

  // Show typing indicator
  addTypingIndicator(messagesContainer);

  try {
    // Use the persistent Cockpit Agent
    const response = await agent.process(message);

    // Remove typing indicator
    removeTypingIndicator();

    // Display response
    addMessage("assistant", response, messagesContainer);
  } catch (error) {
    console.error("Agent error:", error);
    removeTypingIndicator();
    addMessage(
      "assistant",
      "⚠️ Sorry, I encountered an error. Please try again.",
      messagesContainer
    );
  }
}

/**
 * Handle action card clicks
 */
async function handleActionCard(action, messagesContainer, agent) {
  addTypingIndicator(messagesContainer);
  
  const actionMessages = {
    search: "search for products",
    orders: "show me orders",
    returns: "show me returns",
    payments: "show me payments",
    wishlist: "show me wishlist",
  };

  const response = await agent.process(actionMessages[action]);
  
  removeTypingIndicator();
  addMessage("assistant", response, messagesContainer);
}

/**
 * Add a message to the chat
 */
function addMessage(type, content, container) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", type);

  const messageContent = document.createElement("div");
  messageContent.classList.add("message-content");
  messageContent.innerHTML = `<p>${content}</p>`;

  messageDiv.appendChild(messageContent);
  container.appendChild(messageDiv);

  // Add click handlers for add to cart buttons
  const addToCartBtns = messageContent.querySelectorAll(".add-to-cart-btn");
  addToCartBtns.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const sku = btn.dataset.sku;
      const name = btn.dataset.name;
      
      // Disable button and show loading state
      btn.disabled = true;
      btn.textContent = "Adding...";
      
      try {
        const agent = new CockpitAgent();
        const response = await agent.process(`add to cart sku: ${sku}`);
        
        // Show success message
        addMessage("assistant", response, container);
      } catch (error) {
        addMessage("assistant", `❌ Failed to add ${name} to cart`, container);
      } finally {
        btn.disabled = false;
        btn.textContent = "🛒 Add to Cart";
      }
    });
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

/**
 * Add typing indicator
 */
function addTypingIndicator(container) {
  const indicator = document.createElement("div");
  indicator.classList.add("message", "assistant", "typing-indicator");
  indicator.id = "typing-indicator";
  indicator.innerHTML = `
    <div class="message-content">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) {
    indicator.remove();
  }
}
