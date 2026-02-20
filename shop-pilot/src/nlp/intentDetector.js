/**
 * Multi-Intent Detector
 * Detects multiple intents in a single query
 */
export default class IntentDetector {
  constructor() {
    this.intents = null;
    this.loadIntents();
  }

  /**
   * Load intents configuration
   */
  async loadIntents() {
    try {
      let intentsConfig;
      
      // Check if we're in Node.js or browser environment
      if (typeof window === 'undefined') {
        // Node.js environment - use fs
        const fs = await import('fs/promises');
        const path = await import('path');
        const url = await import('url');
        
        const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
        const configPath = path.resolve(__dirname, '../../config/intents.json');
        const data = await fs.readFile(configPath, 'utf-8');
        intentsConfig = JSON.parse(data);
      } else {
        // Browser environment - use fetch
        const response = await fetch('/shop-pilot/config/intents.json');
        intentsConfig = await response.json();
      }
      
      this.intents = intentsConfig.intents;
    } catch (error) {
      console.error('Failed to load intents config:', error);
      // Fallback to basic intents
      this.intents = [
        {
          name: 'search_products',
          patterns: ['show', 'find', 'search', 'looking for', 'want'],
          entities: ['product_type', 'brand', 'price_range'],
        },
        {
          name: 'track_order',
          patterns: ['track', 'order', 'delivery', 'shipping'],
          entities: ['order_id'],
        },
      ];
    }
  }

  /**
   * Detect intents from DLM output
   * @param {Object} dlmOutput - Output from DLM
   * @returns {Array} List of detected intents with entities
   */
  detect(dlmOutput) {
    // Wait for intents to load if not already loaded
    if (!this.intents) {
      return [];
    }

    const detectedIntents = [];

    // Check each intent definition
    this.intents.forEach((intentDef) => {
      const score = this.scoreIntent(intentDef, dlmOutput);
      const threshold = intentDef.confidenceThreshold || 0.3;
      
      // Only include intents that meet their specific confidence threshold
      if (score >= threshold) {
        detectedIntents.push({
          name: intentDef.name,
          rawScore: score,
          priority: intentDef.priority || 0.5,
          entities: this.extractEntitiesForIntent(intentDef, dlmOutput),
          requiredSlots: intentDef.requiredSlots,
        });
      }
    });

    // Sort by priority first, then by score
    const sorted = detectedIntents.sort((a, b) => {
      // If priorities are different, use priority
      if (Math.abs(a.priority - b.priority) > 0.1) {
        return b.priority - a.priority;
      }
      // If priorities are similar, use score
      return b.rawScore - a.rawScore;
    });
    
    if (sorted.length === 0) {
      return [];
    }
    
    // Always include top intent
    const topIntent = sorted[0];
    
    // Define intent exclusion rules: specific intents block generic ones
    const specificIntents = ['view_cart', 'view_orders', 'track_order', 'add_to_wishlist', 'add_to_cart', 'check_price'];
    const genericIntents = ['product_search'];
    
    // If top intent is specific, don't include generic product_search
    if (specificIntents.includes(topIntent.name)) {
      // Filter out generic intents from secondary results
      const filteredSorted = sorted.filter(intent => 
        intent === topIntent || !genericIntents.includes(intent.name)
      );
      
      if (filteredSorted.length > 1) {
        const secondIntent = filteredSorted[1];
        if (secondIntent.rawScore >= topIntent.rawScore * 0.6) {
          return [topIntent, secondIntent];
        }
      }
      return [topIntent];
    }
    
    // For generic intents as top, allow secondary if strong enough
    if (sorted.length > 1) {
      const secondIntent = sorted[1];
      if (secondIntent.rawScore >= topIntent.rawScore * 0.6) {
        return [topIntent, secondIntent];
      }
    }
    
    // Return only the top intent
    return [topIntent];
  }

  /**
   * Score an intent based on pattern matching
   */
  scoreIntent(intentDef, dlmOutput) {
    let score = 0;
    let hasPatternMatch = false;

    // Check if any patterns match
    intentDef.patterns.forEach((pattern) => {
      const patternWords = pattern.toLowerCase().split(' ');
      const matchCount = patternWords.filter((word) => 
        dlmOutput.tokens.includes(word) || 
        dlmOutput.verbs.some((v) => v.toLowerCase().includes(word)) ||
        dlmOutput.nouns.some((n) => n.toLowerCase().includes(word)) ||
        dlmOutput.originalText.toLowerCase().includes(word)
      ).length;

      const matchRatio = matchCount / patternWords.length;
      
      // Require stricter matching for multi-word patterns
      const minMatchRatio = patternWords.length > 1 ? 0.7 : 0.5;
      
      if (matchRatio >= minMatchRatio) {
        score += matchRatio * 2;
        hasPatternMatch = true;
      }
    });

    // Must have at least some pattern match to be valid
    if (!hasPatternMatch) {
      return 0;
    }

    // Boost for entity presence when relevant
    if (dlmOutput.entities.products.length > 0 && intentDef.entities.includes('product')) {
      score += 0.3;
    }

    return score;
  }

  /**
   * Extract entities specific to detected intent
   */
  extractEntitiesForIntent(intentDef, dlmOutput) {
    const entities = {};

    // Extract normalized attributes (color, size, material)
    const normalizedAttributes = dlmOutput.attributes || {};

    if (intentDef.name === 'product_search') {
      // Build query from products and nouns
      const queryParts = [];
      
      // Add normalized attributes to query
      if (normalizedAttributes.color) queryParts.push(normalizedAttributes.color);
      if (normalizedAttributes.size) queryParts.push(normalizedAttributes.size);
      if (normalizedAttributes.material) queryParts.push(normalizedAttributes.material);
      
      // Add products/nouns
      if (dlmOutput.entities.products.length > 0) {
        queryParts.push(...dlmOutput.entities.products);
      } else if (dlmOutput.nouns.length > 0) {
        queryParts.push(...dlmOutput.nouns);
      }
      
      entities.query = queryParts.join(' ') || 
                       dlmOutput.tokens.filter(t => !dlmOutput.verbs.includes(t)).join(' ');
      entities.attributes = normalizedAttributes;
      
    } else if (intentDef.name === 'add_to_cart') {
      entities.product = dlmOutput.entities.products[0];
      entities.quantity = dlmOutput.numbers[0] || 1;
      entities.attributes = normalizedAttributes;
      entities.sku = dlmOutput.entities.sku || null; // Extract SKU from DLM
      
    } else if (intentDef.name === 'add_to_wishlist') {
      entities.product = dlmOutput.entities.products[0];
      entities.attributes = normalizedAttributes;
      entities.sku = dlmOutput.entities.sku || null; // Extract SKU from DLM
      
    } else if (intentDef.name === 'check_price') {
      entities.product = dlmOutput.entities.products[0] || dlmOutput.nouns[0];
      entities.attributes = normalizedAttributes;
      
    } else if (intentDef.name === 'track_order') {
      entities.order_number = dlmOutput.orderId || dlmOutput.numbers[0];
      
    } else if (intentDef.name === 'cancel_order') {
      // Extract order number - try orderId first, then fall back to numbers
      entities.order_number = dlmOutput.orderId || dlmOutput.numbers[0];
      
      // Extract reason - check for explicit "reason" keyword first
      const text = dlmOutput.originalText;
      let reasonText = null;
      
      // Pattern 1: Explicit "reason" keyword (e.g., "reason other")
      const reasonMatch = text.match(/reason\s+(.+)/i);
      if (reasonMatch) {
        reasonText = reasonMatch[1].trim();
      } else {
        // Pattern 2: Extract from remaining text after order number
        const orderNum = entities.order_number;
        reasonText = text
          .replace(/cancel|order|my/gi, '')
          .replace(orderNum || '', '')
          .trim();
      }
      
      entities.reason = reasonText || null;
      
    } else if (intentDef.name === 'return_order') {
      // Extract order number - try orderId first, then fall back to numbers
      entities.order_number = dlmOutput.orderId || dlmOutput.numbers[0];
      
      // Extract reason - check for explicit "reason" keyword first
      const text = dlmOutput.originalText;
      let reasonText = null;
      
      // Pattern 1: Explicit "reason" keyword (e.g., "reason defective")
      const reasonMatch = text.match(/reason\s+(.+)/i);
      if (reasonMatch) {
        reasonText = reasonMatch[1].trim();
      } else {
        // Pattern 2: Extract from remaining text after order number
        const orderNum = entities.order_number;
        reasonText = text
          .replace(/return|order|my/gi, '')
          .replace(orderNum || '', '')
          .trim();
      }
      
      entities.reason = reasonText || null;
      
    } else if (intentDef.name === 'view_orders') {
      // No entities needed for view_orders
      
    } else if (intentDef.name === 'view_cart') {
      // No entities needed for view_cart
    }

    return entities;
  }
}
