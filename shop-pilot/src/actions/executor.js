import EcommerceAPI from './ecommerceApi.js';
import Logger from '../utils/logger.js';
import OrderListUI from '../components/OrderListUI.js';

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

    // Safety check for undefined or empty array
    if (!scoredIntents || !Array.isArray(scoredIntents)) {
      return results;
    }

    for (const intent of scoredIntents) {
      // Skip undefined intents
      if (!intent || !intent.name) {
        continue;
      }

      // Only execute high confidence intents (or those marked as high in clarification flow)
      if (intent.confidenceLevel && intent.confidenceLevel !== 'high') {
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
      
      case 'place_order':
        return await this.handlePlaceOrder(intent.entities);
      
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
      message: `🔍 Found ${results.total} product${results.total > 1 ? 's' : ''} matching "${entities.query}"`,
      data: results,
      displayAs: 'ui' // Flag to render as UI component
    };
  }

  async handleAddToCart(entities) {
    // Validate SKU is present
    if (!entities.sku) {
      return {
        success: false,
        intent: 'add_to_cart',
        message: `❌ Cannot add to cart without product SKU. Please search for the product first.`,
        requiresSearch: true
      };
    }
    
    try {
      const result = await this.api.addToCart(
        entities.sku, 
        entities.quantity || 1,
        {
          parentSku: entities.parentSku,
          optionsUIDs: entities.optionsUIDs,
          enteredOptions: entities.enteredOptions
        }
      );
      
      const itemCount = result?.items?.length || entities.quantity || 1;
      const productName = entities.product || entities.sku;
      
      return {
        success: true,
        intent: 'add_to_cart',
        message: `✅ Added ${entities.quantity || 1}x ${productName} to cart`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        intent: 'add_to_cart',
        message: `❌ Failed to add product to cart: ${error.message}`,
        error: error.message
      };
    }
  }

  async handleAddToWishlist(entities) {
    // Validate SKU is present
    if (!entities.sku) {
      return {
        success: false,
        intent: 'add_to_wishlist',
        message: `❌ Cannot add to wishlist without product SKU. Please search for the product first.`,
        requiresSearch: true
      };
    }
    
    try {
      const result = await this.api.addToWishlist(
        entities.sku,
        entities.quantity || 1,
        {
          optionsUIDs: entities.optionsUIDs,
          enteredOptions: entities.enteredOptions
        }
      );
      
      const productName = entities.product || entities.sku;
      
      return {
        success: true,
        intent: 'add_to_wishlist',
        message: `❤️ Added ${entities.quantity || 1}x ${productName} to wishlist`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        intent: 'add_to_wishlist',
        message: `❌ Failed to add product to wishlist: ${error.message}`,
        error: error.message
      };
    }
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
      displayAs: 'ui',
      message: orders.length > 0 ? '' : 'You have no orders yet',
      data: orders,
      ui: OrderListUI
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

  async handlePlaceOrder(entities) {
    try {
      // Get the current cart ID from the cart API
      const cartId = await this.api.getCartId();
      
      if (!cartId) {
        return {
          success: false,
          intent: 'place_order',
          message: `❌ No active cart found. Please add items to cart first.`,
          requiresCart: true
        };
      }
      
      const result = await this.api.placeOrder(cartId);
      
      if (!result) {
        return {
          success: false,
          intent: 'place_order',
          message: `❌ Failed to place order`,
          error: 'No order data returned'
        };
      }
      
      return {
        success: true,
        intent: 'place_order',
        message: `✅ Order placed successfully! Order number: ${result.number || result.id}`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        intent: 'place_order',
        message: `❌ Failed to place order: ${error.message}`,
        error: error.message
      };
    }
  }
}
