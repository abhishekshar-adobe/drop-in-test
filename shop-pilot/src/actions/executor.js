import EcommerceAPI from './ecommerceApi.js';
import Logger from '../utils/logger.js';
import OrderListUI from '../components/OrderListUI.js';
import { detectMetric, extractTimeRange, buildAnalyticsRequest, executeAggregation, formatAnalyticsResult } from '../utils/analytics.js';
import { formatNaturalResponse, shouldFormatNaturally } from '../utils/responseFormatter.js';

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

    let result;
    
    switch (intent.name) {
      case 'product_search':
        result = await this.handleProductSearch(intent.entities);
        break;
      
      case 'add_to_cart':
        result = await this.handleAddToCart(intent.entities);
        break;
      
      case 'add_to_wishlist':
        result = await this.handleAddToWishlist(intent.entities);
        break;
      
      case 'check_price':
        result = await this.handleCheckPrice(intent.entities);
        break;
      
      case 'view_orders':
        result = await this.handleViewOrders();
        break;
      
      case 'track_order':
        result = await this.handleTrackOrder(intent.entities);
        break;
      
      case 'view_cart':
        result = await this.handleViewCart();
        break;
      
      case 'place_order':
        result = await this.handlePlaceOrder(intent.entities);
        break;
      
      case 'cancel_order':
        result = await this.handleCancelOrder(intent.entities);
        break;
      
      case 'return_order':
        result = await this.handleReturnOrder(intent.entities);
        break;
      
      case 'analytics_query':
        result = await this.handleAnalyticsQuery(intent.entities, intent.text);
        break;
      
      default:
        result = {
          success: false,
          intent: intent.name,
          message: `❌ Unknown intent: ${intent.name}`
        };
    }
    
    // Apply natural language formatting for text responses
    if (shouldFormatNaturally(result)) {
      const naturalMessage = formatNaturalResponse(intent.name, result);
      if (naturalMessage) {
        result.message = naturalMessage;
      }
    }
    
    return result;
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

  async handleCancelOrder(entities) {
    const { order_number, reason } = entities;
    
    if (!order_number) {
      return {
        success: false,
        intent: 'cancel_order',
        message: '❌ Order number is required to cancel an order.'
      };
    }

    if (!reason) {
      return {
        success: false,
        intent: 'cancel_order',
        message: '❌ Cancellation reason is required.'
      };
    }

    try {
      
      // Call the cancelOrder API
      const result = await this.api.cancelOrder(
        order_number,
        reason,
        (orderData) => {
          // Success callback
          this.logger.info('Order cancelled successfully:', orderData);
        },
        (error) => {
          // Error callback
          this.logger.error('Order cancellation failed:', error);
        }
      );

      return {
        success: true,
        intent: 'cancel_order',
        message: `✅ Order #${order_number} has been cancelled successfully.`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        intent: 'cancel_order',
        message: `❌ Failed to cancel order: ${error.message}`
      };
    }
  }

  async handleReturnOrder(entities) {
    const { order_number, reason } = entities;
    
    if (!order_number) {
      return {
        success: false,
        intent: 'return_order',
        message: '❌ Order number is required to initiate a return.'
      };
    }

    if (!reason) {
      return {
        success: false,
        intent: 'return_order',
        message: '❌ Return reason is required.'
      };
    }

    try {
      
      // Call the requestReturn API
      const result = await this.api.requestReturn(
        order_number,
        reason,
        (returnData) => {
          // Success callback
          this.logger.info('Return requested successfully:', returnData);
        },
        (error) => {
          // Error callback
          this.logger.error('Return request failed:', error);
        }
      );

      return {
        success: true,
        intent: 'return_order',
        message: `✅ Return request for order #${order_number} has been initiated successfully. You will receive confirmation shortly.`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        intent: 'return_order',
        message: `❌ Failed to request return: ${error.message}`
      };
    }
  }

  /**
   * Handle analytics query
   */
  async handleAnalyticsQuery(entities, text) {
    try {
      // Step 1: Detect metric from text
      const metricInfo = detectMetric(text);
      
      // Step 2: Extract time range from text
      const timeRange = extractTimeRange(text);
      
      // Step 3: Build structured analytics request
      const request = buildAnalyticsRequest({
        text,
        metric: metricInfo.metric,
        field: metricInfo.field,
        product: entities.product,
        category: entities.category,
        brand: entities.brand,
        timeRange
      });
      
      // Step 4: Fetch order data
      const orders = await this.api.getOrders();
      
      if (!orders || orders.length === 0) {
        return {
          success: false,
          intent: 'analytics_query',
          message: '📊 No order data available for analytics.'
        };
      }
      
      // Step 5: Execute aggregation
      const result = executeAggregation(request, orders);
      
      // Step 6: Format result
      const message = formatAnalyticsResult(request, result);
      
      // Determine display mode
      let displayAs = 'text';
      if (request.metric === 'list' || request.metric === 'top') {
        displayAs = 'ui';
      }
      
      return {
        success: true,
        intent: 'analytics_query',
        message,
        displayAs,
        data: {
          request,
          result,
          orders: result.orders || []
        }
      };
    } catch (error) {
      return {
        success: false,
        intent: 'analytics_query',
        message: `❌ Analytics query failed: ${error.message}`
      };
    }
  }
}
