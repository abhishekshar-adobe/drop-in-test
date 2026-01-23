import EcommerceAPI from './ecommerceApi.js';
import Logger from '../utils/logger.js';

/**
 * Action Executor
 * Maps intents to actions and executes them
 */
export default class ActionExecutor {
  constructor() {
    this.api = new EcommerceAPI();
    this.logger = new Logger();
  }

  /**
   * Execute actions for detected intents
   * @param {Array} scoredIntents - Intents with confidence scores
   * @returns {Promise<Array>} Results of executed actions
   */
  async execute(scoredIntents) {
    const results = [];

    for (const intent of scoredIntents) {
      // Only execute high confidence intents
      if (intent.confidenceLevel !== 'high') {
        continue;
      }

      try {
        const result = await this.executeIntent(intent);
        results.push(result);
      } catch (error) {
        this.logger.error(`Error executing ${intent.name}:`, error);
        results.push({
          success: false,
          intent: intent.name,
          message: `❌ Failed to execute ${intent.name}: ${error.message}`
        });
      }
    }

    return results;
  }

  /**
   * Execute single intent
   */
  async executeIntent(intent) {
    this.logger.info(`Executing intent: ${intent.name}`);

    switch (intent.name) {
      case 'product_search':
        return await this.handleProductSearch(intent.entities);
      
      case 'add_to_cart':
        return await this.handleAddToCart(intent.entities);
      
      case 'add_to_wishlist':
        return await this.handleAddToWishlist(intent.entities);
      
      case 'check_price':
        return await this.handleCheckPrice(intent.entities);
      
      case 'view_orders':
        return await this.handleViewOrders();
      
      case 'track_order':
        return await this.handleTrackOrder(intent.entities);
      
      case 'view_cart':
        return await this.handleViewCart();
      
      default:
        return {
          success: false,
          intent: intent.name,
          message: `❌ Unknown intent: ${intent.name}`
        };
    }
  }

  async handleProductSearch(entities) {
    const results = await this.api.searchProducts(entities.query, entities.attributes);
    
    if (results.total === 0) {
      return {
        success: false,
        intent: 'product_search',
        message: `😞 No products found matching "${entities.query}"`
      };
    }

    return {
      success: true,
      intent: 'product_search',
      message: `🔍 Found ${results.total} products matching "${entities.query}"`,
      data: results
    };
  }

  async handleAddToCart(entities) {
    const result = await this.api.addToCart(entities.product, entities.quantity);
    return {
      success: true,
      intent: 'add_to_cart',
      message: `✅ Added ${entities.quantity}x ${entities.product} to cart`,
      data: result
    };
  }

  async handleAddToWishlist(entities) {
    const result = await this.api.addToWishlist(entities.product);
    return {
      success: true,
      intent: 'add_to_wishlist',
      message: `❤️ Added ${entities.product} to wishlist`,
      data: result
    };
  }

  async handleCheckPrice(entities) {
    const price = await this.api.getPrice(entities.product);
    return {
      success: true,
      intent: 'check_price',
      message: `💰 ${entities.product} costs $${price.toFixed(2)}`,
      data: { price }
    };
  }

  async handleViewOrders() {
    const orders = await this.api.getOrders();
    return {
      success: true,
      intent: 'view_orders',
      message: `📦 You have ${orders.length} orders`,
      data: orders
    };
  }

  async handleTrackOrder(entities) {
    const tracking = await this.api.trackOrder(entities.order_number);
    return {
      success: true,
      intent: 'track_order',
      message: `📍 Order ${entities.order_number} status: ${tracking.status}`,
      data: tracking
    };
  }

  async handleViewCart() {
    const cart = await this.api.getCart();
    return {
      success: true,
      intent: 'view_cart',
      message: `🛒 You have ${cart.itemCount} items in your cart`,
      data: cart
    };
  }
}
