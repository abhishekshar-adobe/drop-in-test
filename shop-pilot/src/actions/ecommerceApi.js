import config from '../../config/config.js';
import apiConfig from '../../config/api-config.js';

/**
 * E-commerce API Interface
 * Connects to Adobe Commerce / Magento GraphQL API
 */
export default class EcommerceAPI {
  constructor() {
    this.endpoint = apiConfig.baseURL;
    this.headers = apiConfig.headers;
  }

  /**
   * Make GraphQL request to AEM Commerce
   */
  async graphqlRequest(query, variables = {}) {
    try {
      // Build URL with cache buster
      const url = new URL(this.endpoint);
      url.searchParams.set('cb', Math.random().toString(36).substring(7));
      
      // Use POST request with JSON body (standard GraphQL approach)
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query.replace(/\s+/g, ' ').trim(),
          variables
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Response error:', response.status, errorText);
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error('[API] GraphQL errors:', result.errors);
        throw new Error(result.errors[0]?.message || 'GraphQL query failed');
      }
      
      return result.data;
    } catch (error) {
      console.error('[API] Request failed:', error);
      throw error;
    }
  }

  /**
   * Search products using AEM Commerce GraphQL
   */
  async searchProducts(query, attributes = {}) {
    try {
      console.log(`[API] Searching products: ${query}`, attributes);
      
      // Build filter array based on attributes
      const filters = [
        {
          attribute: 'categoryPath',
          eq: apiConfig.defaultCategory
        },
        {
          attribute: 'visibility',
          in: ['Search', 'Catalog, Search']
        }
      ];
      
      // Add color filter if present
      if (attributes.color) {
        filters.push({
          attribute: 'color',
          eq: attributes.color
        });
      }
      
      // Add size filter if present
      if (attributes.size) {
        filters.push({
          attribute: 'size',
          eq: attributes.size
        });
      }
      
      // Add material filter if present
      if (attributes.material) {
        filters.push({
          attribute: 'material',
          eq: attributes.material
        });
      }

      const variables = {
        phrase: query || '',
        pageSize: apiConfig.defaultPageSize,
        currentPage: 1,
        filter: filters,
        sort: [
          {
            attribute: 'position',
            direction: 'ASC'
          }
        ]
      };

      const data = await this.graphqlRequest(apiConfig.queries.productSearch, variables);
      
      // Transform response to simplified format
      const products = data.productSearch.items.map(item => {
        const product = item.productView;
        let price = 0;
        
        // Extract price based on product type
        if (product.__typename === 'SimpleProductView') {
          price = product.price?.final?.amount?.value || 0;
        } else if (product.__typename === 'ComplexProductView') {
          price = product.priceRange?.minimum?.final?.amount?.value || 0;
        }
        
        return {
          sku: product.sku,
          name: product.name,
          price: price,
          currency: product.price?.final?.amount?.currency || 
                   product.priceRange?.minimum?.final?.amount?.currency || 'USD',
          inStock: product.inStock,
          url: product.url,
          image: product.images?.[0]?.url || null,
          type: product.__typename
        };
      });
      
      return {
        total: data.productSearch.total_count,
        items: products,
        pageInfo: data.productSearch.page_info
      };
    } catch (error) {
      console.error('[API] Product search failed:', error);
      // Fallback to mock data if API fails
      return {
        total: 3,
        items: [
          { sku: 'PROD-001', name: `${query} #1`, price: 29.99, inStock: true },
          { sku: 'PROD-002', name: `${query} #2`, price: 39.99, inStock: true },
          { sku: 'PROD-003', name: `${query} #3`, price: 49.99, inStock: true }
        ],
        pageInfo: {
          current_page: 1,
          page_size: 3,
          total_pages: 1
        }
      };
    }
  }

  /**
   * Add product to cart
   */
  /**
   * Add product to cart using storefront-cart dropin
   */
  async addToCart(sku, quantity = 1, options = {}) {
    try {
      console.log(`[API] Adding to cart: ${quantity}x ${sku}`);
      
      // Import the cart dropin API
      const cartApi = await import('../../../scripts/__dropins__/storefront-cart/api.js');
      
      // Add product to cart with just SKU and quantity
      const result = await cartApi.addProductsToCart([
        {
          sku,
          quantity,
          ...(options.parentSku && { parentSku: options.parentSku }),
          ...(options.optionsUIDs && { optionsUIDs: options.optionsUIDs }),
          ...(options.enteredOptions && { enteredOptions: options.enteredOptions })
        }
      ]);
      
      console.log('[API] Add to cart result:', result);
      return result;
    } catch (error) {
      console.error('[API] Add to cart failed:', error);
      throw error;
    }
  }

  /**
   * Add product to wishlist using storefront-wishlist dropin (handles CORS)
   */
  async addToWishlist(sku, quantity = 1, options = {}) {
    try {
      console.log(`[API] Adding to wishlist: ${quantity}x ${sku}`);
      
      // Import the wishlist dropin API which handles CORS and authentication
      const wishlistApi = await import('../../../scripts/__dropins__/storefront-wishlist/api.js');
      
      // Add product to wishlist with just SKU and quantity
      const result = await wishlistApi.addProductsToWishlist([
        {
          sku,
          quantity
        }
      ]);
      
      console.log('[API] Add to wishlist result:', result);
      return result;
    } catch (error) {
      console.error('[API] Add to wishlist failed:', error);
      throw error;
    }
  }

  /**
   * Get product price
   */
  async getPrice(product) {
    try {
      console.log(`[API] Getting price for: ${product}`);
      
      // Mock price
      return 29.99 + Math.random() * 50;
    } catch (error) {
      console.error('[API] Get price failed:', error);
      throw error;
    }
  }

  /**
   * Get customer orders using storefront-order dropin fetchGraphQl (handles CORS)
   * @param {Object} options - Query options
   * @param {number} options.currentPage - Current page number (default: 1)
   * @param {number} options.pageSize - Number of orders per page (default: 10)
   */
  async getOrders(options = {}) {
    try {
      console.log('[API] Getting customer orders');
      
      const {
        currentPage = 1,
        pageSize = 10,
        filter = {},
        sort = { sort_direction: 'DESC', sort_field: 'CREATED_AT' }
      } = options;

      const query = `
        query GET_CUSTOMER_ORDERS_LIST(
          $currentPage: Int
          $pageSize: Int
          $filter: CustomerOrdersFilterInput
          $sort: CustomerOrderSortInput
        ) {
          customer {
            orders(
              currentPage: $currentPage
              pageSize: $pageSize
              filter: $filter
              sort: $sort
            ) {
              page_info {
                page_size
                total_pages
                current_page
              }
              total_count
              items {
                token
                email
                number
                id
                order_date
                status
                carrier
                shipping_method
                total {
                  grand_total {
                    value
                    currency
                  }
                }
                items {
                  product_name
                  product_sku
                  quantity_ordered
                }
              }
            }
          }
        }
      `;

      const variables = {
        currentPage,
        pageSize,
        filter,
        sort
      };

      const orderApi = await import('../../../scripts/__dropins__/storefront-order/api.js');
      const result = await orderApi.fetchGraphQl(query, variables);
      
      if (result.errors) {
        console.error('[API] GraphQL errors:', result.errors);
        throw new Error(result.errors[0]?.message || 'Failed to fetch orders');
      }
      
      console.log('[API] Customer orders result:', result.data?.customer?.orders);
      
      return result.data?.customer?.orders?.items || [];
    } catch (error) {
      console.error('[API] Get orders failed:', error);
      throw error;
    }
  }

  /**
   * Track order by order number using storefront-order dropin
   */
  async trackOrder(orderNumber) {
    try {
      console.log(`[API] Tracking order: ${orderNumber}`);
      
      const orderApi = await import('../../../scripts/__dropins__/storefront-order/api.js');
      const result = await orderApi.getOrderDetailsById(orderNumber);
      
      console.log('[API] Track order result:', result);
      return result;
    } catch (error) {
      console.error('[API] Track order failed:', error);
      throw error;
    }
  }

  /**
   * Get guest order by token using storefront-order dropin
   */
  async guestOrderByToken(token, returnRef) {
    try {
      console.log(`[API] Getting guest order by token`, { token, returnRef });

      const orderApi = await import('../../../scripts/__dropins__/storefront-order/api.js');
      const result = await orderApi.guestOrderByToken(token, returnRef);
      
      console.log('[API] Guest order result:', result);
      return result;
    } catch (error) {
      console.error('[API] Get guest order failed:', error);
      throw error;
    }
  }

  /**
   * Get cart
   */
  async getCart() {
    try {
      console.log('[API] Getting cart');
      
      return {
        id: 'cart-123',
        itemCount: 3,
        total: 119.97
      };
    } catch (error) {
      console.error('[API] Get cart failed:', error);
      throw error;
    }
  }

  /**
   * Get cart ID from the storefront-cart dropin
   * @returns {Promise<string | null>} The cart ID or null if no cart exists
   */
  async getCartId() {
    try {
      console.log('[API] Getting cart ID');
      
      // Import the cart dropin to access cart state
      const cartModule = await import('../../../scripts/__dropins__/storefront-cart/chunks/resetCart.js');
      const cartId = cartModule.s.cartId;
      
      console.log('[API] Cart ID:', cartId);
      return cartId;
    } catch (error) {
      console.error('[API] Get cart ID failed:', error);
      return null;
    }
  }

  /**
   * Place order using storefront-order dropin
   * @param {string} cartId - The cart ID to place order for
   * @returns {Promise<OrderDataModel | null | undefined>}
   */
  async placeOrder(cartId) {
    try {
      console.log(`[API] Placing order for cart: ${cartId}`);
      
      const orderApi = await import('../../../scripts/__dropins__/storefront-order/api.js');
      const result = await orderApi.placeOrder(cartId);
      
      console.log('[API] Place order result:', result);
      return result;
    } catch (error) {
      console.error('[API] Place order failed:', error);
      throw error;
    }
  }
}
