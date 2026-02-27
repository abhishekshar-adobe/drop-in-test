/**
 * Clarification System
 * Generates clarification questions when confidence is low
 */
export default class Clarification {
  /**
   * Generate clarification response
   * @param {Array} scoredIntents - Intents with confidence scores
   * @returns {Object} Clarification response
   */
  generate(scoredIntents) {
    if (scoredIntents.length === 0) {
      return {
        success: false,
        needsClarification: true,
        message: "🤔 I'm not sure what you're looking for. Could you rephrase that?",
        suggestions: [
          "Search for products",
          "View my orders",
          "Add item to cart"
        ]
      };
    }

    const topIntents = scoredIntents.slice(0, 2);

    // Multiple similar intents - ask which one
    if (topIntents.length > 1 && 
        Math.abs(topIntents[0].confidence - topIntents[1].confidence) < 0.2) {
      return {
        success: false,
        needsClarification: true,
        message: "💡 Did you want to:",
        options: topIntents.map((intent, i) => ({
          id: i + 1,
          label: this.getIntentLabel(intent.name),
          intent: intent.name
        }))
      };
    }

    // Missing required slots
    const topIntent = topIntents[0];
    const missingSlots = this.findMissingSlots(topIntent);

    if (missingSlots.length > 0) {
      return {
        success: false,
        needsClarification: true,
        message: this.generateSlotQuestion(topIntent.name, missingSlots[0]),
        intent: topIntent.name,
        missingSlot: missingSlots[0]
      };
    }

    return {
      success: false,
      needsClarification: true,
      message: "❓ I'm not confident about what you want. Could you provide more details?"
    };
  }

  /**
   * Find missing required slots
   */
  findMissingSlots(intent) {
    const missing = [];

    intent.requiredSlots?.forEach(slot => {
      const value = intent.entities[slot];
      if (!value || value === '' || (Array.isArray(value) && value.length === 0)) {
        missing.push(slot);
      }
    });

    return missing;
  }

  /**
   * Generate question for missing slot
   */
  generateSlotQuestion(intentName, slot) {
    const questions = {
      product_search: {
        query: "🔍 What product would you like to search for?"
      },
      add_to_cart: {
        product: "🛒 Which product would you like to add?",
        sku: "📦 Could you provide the product SKU or search for a product first?"
      },
      check_price: {
        product: "💰 Which product's price would you like to know?"
      },
      track_order: {
        order_number: "📋 What's your order number?"
      }
    };

    return questions[intentName]?.[slot] || `Could you provide the ${slot}?`;
  }

  /**
   * Get user-friendly intent label
   */
  getIntentLabel(intentName) {
    const labels = {
      product_search: "🔍 Search for products",
      add_to_cart: "🛒 Add to cart",
      add_to_wishlist: "❤️ Add to wishlist",
      check_price: "💰 Check price",
      view_orders: "📦 View orders",
      track_order: "📍 Track an order",
      view_cart: "🛒 View cart",
      reset_cart: "🗑️ Clear cart"
    };

    return labels[intentName] || intentName;
  }
}
