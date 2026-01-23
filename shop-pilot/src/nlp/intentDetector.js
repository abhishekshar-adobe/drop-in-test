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
      const response = await fetch('/shop-pilot/config/intents.json');
      const intentsConfig = await response.json();
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
      
      // Only include intents with meaningful scores
      if (score >= 0.3) {
        detectedIntents.push({
          name: intentDef.name,
          rawScore: score,
          entities: this.extractEntitiesForIntent(intentDef, dlmOutput),
          requiredSlots: intentDef.requiredSlots,
        });
      }
    });

    // Sort by score and filter intelligently
    const sorted = detectedIntents.sort((a, b) => b.rawScore - a.rawScore);
    
    if (sorted.length === 0) {
      return [];
    }
    
    // Always include top intent
    const topIntent = sorted[0];
    
    // Only include second intent if it's at least 60% as strong as the top
    // This prevents weak secondary intents from being triggered
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
      if (matchRatio > 0) {
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

    if (intentDef.name === 'product_search') {
      entities.query = dlmOutput.entities.products.join(' ') || 
                       dlmOutput.nouns.join(' ') || 
                       dlmOutput.tokens.filter(t => !dlmOutput.verbs.includes(t)).join(' ');
      entities.attributes = dlmOutput.attributes;
    } else if (intentDef.name === 'add_to_cart') {
      entities.product = dlmOutput.entities.products[0];
      entities.quantity = dlmOutput.numbers[0] || 1;
      entities.sku = null; // Will be resolved later
    } else if (intentDef.name === 'check_price') {
      entities.product = dlmOutput.entities.products[0] || dlmOutput.nouns[0];
    } else if (intentDef.name === 'track_order') {
      entities.order_number = dlmOutput.numbers[0];
    }

    return entities;
  }
}
