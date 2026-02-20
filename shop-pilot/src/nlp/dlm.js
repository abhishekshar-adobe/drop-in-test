import tokenizer from '../utils/tokenizer.js';

/**
 * Domain Language Model (DLM)
 * Specialized for e-commerce domain
 */
export default class DLM {
  constructor() {
    // E-commerce domain vocabulary (loaded from config)
    this.domainVocabulary = {
      products: [],
      actions: [],
      attributes: [],
      modifiers: []
    };

    // Canonical entity mappings (loaded from config)
    this.canonicalMappings = {};
    
    // Patterns (loaded from config)
    this.patterns = {};
    
    this.intentsLoaded = false;
    this.loadIntents();
  }

  /**
   * Load intents configuration to get canonical entity mappings
   */
  async loadIntents() {
    if (this.intentsLoaded) return;

    try {
      let config;
      
      // Check if we're in Node.js or browser environment
      if (typeof window === 'undefined') {
        // Node.js environment - use fs
        const fs = await import('fs/promises');
        const path = await import('path');
        const url = await import('url');
        
        const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
        const configPath = path.resolve(__dirname, '../../config/intents.json');
        const data = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(data);
      } else {
        // Browser environment - use fetch
        const response = await fetch('/shop-pilot/config/intents.json');
        config = await response.json();
      }
      
      // Extract canonical mappings from entities config
      const attributeEntity = config.entities.find(e => e.name === 'attribute');
      if (attributeEntity && attributeEntity.properties) {
        this.canonicalMappings = attributeEntity.properties;
      }
      
      // Load vocabulary
      if (config.vocabulary) {
        this.domainVocabulary = config.vocabulary;
      }
      
      // Load patterns and convert strings to RegExp
      if (config.patterns) {
        Object.entries(config.patterns).forEach(([name, pattern]) => {
          this.patterns[name] = new RegExp(pattern, 'i');
        });
      }
      
      this.intentsLoaded = true;
    } catch (error) {
      console.warn('Failed to load intents config for entity normalization:', error);
      // Fallback to basic mappings
      this.domainVocabulary = {
        products: ['shoe', 'shirt', 'pants', 'jacket', 'dress'],
        actions: ['search', 'find', 'buy', 'add', 'show'],
        attributes: ['color', 'size', 'material'],
        modifiers: ['cheap', 'expensive', 'large', 'small']
      };
      
      this.patterns = {
        searchPattern: /(?:search|find|look for|show me)\s+(.+)/i,
        addToCartPattern: /(?:add|put)\s+(.+?)\s+(?:to|in)\s+cart/i,
        pricePattern: /(?:price|cost|how much)\s+(?:is|for|of)?\s*(.+)/i,
        quantityPattern: /(\d+)\s*(?:x\s*)?(.+)/i
      };
      
      this.canonicalMappings = {
        color: {
          canonical: {
            red: ['red', 'crimson'],
            blue: ['blue', 'navy'],
            black: ['black'],
            white: ['white']
          }
        },
        size: {
          canonical: {
            xs: ['xs', 'extra small'],
            s: ['s', 'small'],
            m: ['m', 'medium'],
            l: ['l', 'large'],
            xl: ['xl', 'extra large']
          }
        }
      };
    }
  }

  /**
   * Process input through domain model
   * @param {string} text - Raw user input
   * @returns {Object} Processed output with domain-specific insights
   */
  async process(text) {
    // Ensure intents are loaded for entity normalization
    if (!this.intentsLoaded) {
      await this.loadIntents();
    }

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
      orderId: this.extractOrderId(text),
      attributes: this.extractAttributes(tokens)
    };

    return semantics;
  }

  /**
   * Extract verbs (action words)
   */
  extractVerbs(tokens) {
    // Use loaded vocabulary instead of hardcoded list
    const actionWords = this.domainVocabulary.actions || [];
    return tokens.filter(t => actionWords.includes(t));
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
   * Extract numbers (excluding numbers within SKUs)
   */
  extractNumbers(text) {
    // First, remove SKU patterns to avoid extracting digits from them
    const skuPattern = /\b[A-Z]{3,4}\d{3,4}\b/gi;
    const textWithoutSkus = text.replace(skuPattern, '');
    
    // Extract standalone numbers including those with leading zeros (like order numbers)
    // Match numbers that are 1+ digits, including those with leading zeros
    const matches = textWithoutSkus.match(/\b0*\d+\b/g);
    
    // Return as strings to preserve leading zeros for order numbers, or as numbers for quantities
    if (!matches) return [];
    
    // Keep as strings if they look like order numbers (6+ digits or have leading zeros)
    return matches.map(m => {
      // If it has leading zeros or is a long number (likely an order number), keep as string
      if (m.length >= 6 || m.startsWith('0')) {
        return m;
      }
      // Otherwise convert to number (for quantities)
      return Number(m);
    });
  }

  /**
   * Extract order ID (can be numeric or base64 encoded)
   */
  extractOrderId(text) {
    // Pattern 1: Any alphanumeric string after "order" keyword (highest priority)
    const orderMatch = text.match(/order\s+([A-Za-z0-9+=\/-]+)/i);
    if (orderMatch && orderMatch[1]) return orderMatch[1];
    
    // Pattern 2: Pure numeric order IDs (with or without leading zeros)
    const numericMatch = text.match(/\b0*\d{6,}\b/);
    if (numericMatch) return numericMatch[0];
    
    // Pattern 3: Base64 encoded IDs (must end with = or ==, more strict)
    const base64Match = text.match(/\b[A-Za-z0-9+\/]{8,}={1,2}\b/);
    if (base64Match) return base64Match[0];
    
    return null;
  }

  /**
   * Extract e-commerce entities
   */
  extractEntities(tokens) {
    const entities = {
      products: [],
      attributes: {},
      quantities: [],
      actions: [],
      sku: null
    };

    // Extract products
    tokens.forEach(token => {
      if (this.domainVocabulary.products.some(p => token.includes(p))) {
        entities.products.push(token);
      }
      if (this.domainVocabulary.actions.includes(token)) {
        entities.actions.push(token);
      }
      // Check if token looks like a SKU (alphanumeric, often starts with letters)
      if (/^[A-Z]{3,4}\d{3,4}$/i.test(token)) {
        entities.sku = token.toUpperCase();
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

    // Use canonical mappings for normalization
    tokens.forEach(token => {
      // Try to normalize each attribute type
      Object.entries(this.canonicalMappings).forEach(([attrType, config]) => {
        const canonical = this.normalizeEntity(token, attrType);
        if (canonical) {
          attributes[attrType] = canonical;
        }
      });
    });

    return attributes;
  }

  /**
   * Normalize entity value to canonical form
   * @param {string} value - Raw entity value
   * @param {string} type - Entity type (color, size, material)
   * @returns {string|null} Canonical value or null
   */
  normalizeEntity(value, type) {
    const mapping = this.canonicalMappings[type];
    if (!mapping || !mapping.canonical) return null;

    const lowerValue = value.toLowerCase();

    // Find canonical form
    for (const [canonical, synonyms] of Object.entries(mapping.canonical)) {
      if (synonyms.includes(lowerValue)) {
        return canonical;
      }
    }

    return null;
  }
}
