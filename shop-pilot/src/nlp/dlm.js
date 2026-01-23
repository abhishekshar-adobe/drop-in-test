import tokenizer from '../utils/tokenizer.js';

/**
 * Domain Language Model (DLM)
 * Specialized for e-commerce domain
 */
export default class DLM {
  constructor() {
    // E-commerce domain vocabulary
    this.domainVocabulary = {
      products: ['shoe', 'shirt', 'pants', 'jacket', 'dress', 'laptop', 'phone', 'watch', 'bag'],
      actions: ['search', 'find', 'buy', 'add', 'remove', 'order', 'track', 'show'],
      attributes: ['color', 'size', 'material', 'brand', 'price'],
      modifiers: ['cheap', 'expensive', 'large', 'small', 'new', 'used']
    };

    // Common e-commerce patterns
    this.patterns = {
      searchPattern: /(?:search|find|look for|show me)\s+(.+)/i,
      addToCartPattern: /(?:add|put)\s+(.+?)\s+(?:to|in)\s+cart/i,
      pricePattern: /(?:price|cost|how much)\s+(?:is|for|of)?\s*(.+)/i,
      quantityPattern: /(\d+)\s*(?:x\s*)?(.+)/i
    };
  }

  /**
   * Process input through domain model
   * @param {string} text - Raw user input
   * @returns {Object} Processed output with domain-specific insights
   */
  async process(text) {
    // Step 1: Tokenize and normalize
    const tokens = tokenizer.normalize(text);

    // Step 2: Use lightweight NLP (without compromise for now)
    const words = tokens;
    const verbs = this.extractVerbs(tokens);
    const nouns = this.extractNouns(tokens);
    const numbers = this.extractNumbers(text);

    // Step 3: Extract domain-specific entities
    const entities = this.extractEntities(tokens);

    // Step 4: Identify patterns
    const patterns = this.matchPatterns(text);

    // Step 5: Build semantic understanding
    const semantics = {
      originalText: text,
      tokens,
      entities,
      patterns,
      verbs,
      nouns,
      numbers,
      attributes: this.extractAttributes(tokens)
    };

    return semantics;
  }

  /**
   * Extract verbs (action words)
   */
  extractVerbs(tokens) {
    const commonVerbs = ['search', 'find', 'add', 'remove', 'buy', 'show', 'track', 'view'];
    return tokens.filter(t => commonVerbs.includes(t));
  }

  /**
   * Extract nouns (product names)
   */
  extractNouns(tokens) {
    return tokens.filter(t => 
      this.domainVocabulary.products.some(p => t.includes(p))
    );
  }

  /**
   * Extract numbers
   */
  extractNumbers(text) {
    const matches = text.match(/\d+/g);
    return matches ? matches.map(Number) : [];
  }

  /**
   * Extract e-commerce entities
   */
  extractEntities(tokens) {
    const entities = {
      products: [],
      attributes: {},
      quantities: [],
      actions: []
    };

    // Extract products
    tokens.forEach(token => {
      if (this.domainVocabulary.products.some(p => token.includes(p))) {
        entities.products.push(token);
      }
      if (this.domainVocabulary.actions.includes(token)) {
        entities.actions.push(token);
      }
    });

    return entities;
  }

  /**
   * Match domain-specific patterns
   */
  matchPatterns(text) {
    const matched = [];

    Object.entries(this.patterns).forEach(([name, pattern]) => {
      const match = text.match(pattern);
      if (match) {
        matched.push({
          pattern: name,
          match: match[1] || match[0],
          fullMatch: match[0]
        });
      }
    });

    return matched;
  }

  /**
   * Extract attributes (color, size, etc.)
   */
  extractAttributes(tokens) {
    const attributes = {};

    const colorWords = ['red', 'blue', 'black', 'white', 'green', 'yellow', 'pink', 'purple'];
    const sizeWords = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'small', 'medium', 'large'];

    tokens.forEach(token => {
      if (colorWords.includes(token)) {
        attributes.color = token;
      }
      if (sizeWords.includes(token)) {
        attributes.size = token;
      }
    });

    return attributes;
  }
}
