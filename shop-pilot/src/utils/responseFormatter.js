/**
 * Natural Response Formatter
 * Generates conversational, natural-sounding responses for text-based intents
 * Only applied when displayAs !== 'ui'
 */

/**
 * Response templates for each intent
 * Multiple variations for natural feel
 */
const RESPONSE_TEMPLATES = {
  add_to_cart: {
    success: [
      "✅ Added {product} to your cart!",
      "✅ Got it! {product} is now in your cart.",
      "✅ Done! Your cart now has {product}.",
      "✅ Perfect! I've added {product} to your cart."
    ],
    error: [
      "❌ I couldn't add that to your cart. {reason}",
      "❌ Oops! There was an issue: {reason}",
      "❌ Sorry, I wasn't able to add that. {reason}"
    ]
  },
  
  add_to_wishlist: {
    success: [
      "❤️ Added {product} to your wishlist!",
      "❤️ Great choice! {product} is now on your wishlist.",
      "❤️ Saved! {product} has been added to your wishlist."
    ],
    error: [
      "❌ I couldn't add that to your wishlist. {reason}",
      "❌ Sorry, there was an issue: {reason}"
    ]
  },
  
  check_price: {
    success: [
      "💰 {product} costs {price}",
      "💰 The price for {product} is {price}",
      "💰 That'll be {price} for {product}"
    ],
    not_found: [
      "😞 I couldn't find pricing for {product}",
      "😞 Sorry, {product} isn't available right now"
    ]
  },
  
  track_order: {
    success: [
      "📍 Order #{order_number} status: {status}",
      "📍 Your order #{order_number} is {status}",
      "📍 Good news! Order #{order_number} is {status}"
    ],
    not_found: [
      "😞 I couldn't find order #{order_number}",
      "😞 Sorry, I don't see an order with number {order_number}"
    ]
  },
  
  view_cart: {
    success: [
      "🛒 Your cart has {count} item(s) - Total: {total}",
      "🛒 You have {count} item(s) in your cart ({total})",
      "🛒 Cart summary: {count} item(s), {total}"
    ],
    empty: [
      "🛒 Your cart is empty",
      "🛒 You don't have anything in your cart yet",
      "🛒 Your shopping cart is currently empty"
    ]
  },
  
  place_order: {
    success: [
      "✅ Order placed successfully! Order number: {order_number}",
      "✅ Great! Your order #{order_number} has been confirmed.",
      "✅ All done! Order #{order_number} is on its way."
    ],
    error: [
      "❌ I couldn't place your order. {reason}",
      "❌ There was an issue: {reason}",
      "❌ Sorry, order placement failed: {reason}"
    ]
  },
  
  cancel_order: {
    success: [
      "✅ Order #{order_number} cancelled successfully!",
      "✅ All done - order #{order_number} has been cancelled.",
      "✅ Your order #{order_number} is now cancelled."
    ],
    error: [
      "❌ I couldn't cancel order #{order_number}. {reason}",
      "❌ Cancellation failed: {reason}"
    ]
  },
  
  return_order: {
    success: [
      "✅ Return request for order #{order_number} has been initiated successfully. You'll receive confirmation shortly.",
      "✅ Got it! Your return request for order #{order_number} is being processed.",
      "✅ Return initiated for order #{order_number}. Check your email for next steps."
    ],
    error: [
      "❌ I couldn't process your return request. {reason}",
      "❌ Return request failed: {reason}"
    ]
  },
  
  analytics_query: {
    sum: [
      "📊 You spent {amount} on {filters} {timeRange}",
      "📊 Your total for {filters} {timeRange}: {amount}",
      "📊 Here's what I found: {amount} spent on {filters} {timeRange}"
    ],
    count: [
      "📊 You placed {count} orders {filters} {timeRange}",
      "📊 Found {count} orders {filters} {timeRange}",
      "📊 Order count {filters} {timeRange}: {count}"
    ],
    avg: [
      "📊 Average order value {filters} {timeRange}: {amount}",
      "📊 Your average spend {filters} {timeRange} is {amount}",
      "📊 On average, you spent {amount} per order {filters} {timeRange}"
    ],
    max: [
      "📊 Your highest order {filters} {timeRange}: {amount}",
      "📊 Most expensive order {filters} {timeRange} was {amount}",
      "📊 Maximum order value {filters} {timeRange}: {amount}"
    ],
    min: [
      "📊 Your lowest order {filters} {timeRange}: {amount}",
      "📊 Cheapest order {filters} {timeRange} was {amount}",
      "📊 Minimum order value {filters} {timeRange}: {amount}"
    ]
  }
};

/**
 * Format natural response for an intent
 * @param {string} intent - Intent name
 * @param {Object} data - Response data from handler
 * @param {Object} context - Conversation context (optional)
 * @returns {string} Formatted natural response
 */
export function formatNaturalResponse(intent, data, context = {}) {
  const templates = RESPONSE_TEMPLATES[intent];
  
  if (!templates) {
    // No templates defined, return original message
    return data.message || '';
  }
  
  // Determine status (success, error, empty, not_found, etc.)
  let status = 'success';
  if (!data.success) {
    status = 'error';
  } else if (intent === 'view_cart' && (!data.data?.items || data.data.items.length === 0)) {
    status = 'empty';
  } else if (intent === 'check_price' && !data.data?.price) {
    status = 'not_found';
  } else if (intent === 'track_order' && !data.data?.order) {
    status = 'not_found';
  } else if (intent === 'analytics_query' && data.data?.request?.metric) {
    status = data.data.request.metric; // Use metric as status for analytics
  }
  
  const statusTemplates = templates[status];
  
  if (!statusTemplates || statusTemplates.length === 0) {
    // No templates for this status, return original message
    return data.message || '';
  }
  
  // Randomly select a template variation
  const template = statusTemplates[Math.floor(Math.random() * statusTemplates.length)];
  
  // Replace placeholders with actual data
  return replacePlaceholders(template, data, intent);
}

/**
 * Replace placeholders in template with actual data
 * @param {string} template - Template string with {placeholder} syntax
 * @param {Object} data - Response data
 * @param {string} intent - Intent name for context-specific extraction
 * @returns {string} Formatted string
 */
function replacePlaceholders(template, data, intent) {
  let result = template;
  
  // Extract common values
  const extractedValues = extractValues(data, intent);
  
  // Replace all placeholders
  Object.keys(extractedValues).forEach(key => {
    const placeholder = `{${key}}`;
    const value = extractedValues[key];
    result = result.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return result;
}

/**
 * Extract values from data based on intent type
 * @param {Object} data - Response data
 * @param {string} intent - Intent name
 * @returns {Object} Extracted values
 */
function extractValues(data, intent) {
  const values = {};
  
  switch (intent) {
    case 'add_to_cart':
    case 'add_to_wishlist':
      values.product = data.data?.product?.name || data.data?.productName || 'the item';
      values.reason = extractErrorReason(data.message);
      break;
      
    case 'check_price':
      values.product = data.data?.product?.name || 'the product';
      values.price = formatPrice(data.data?.price);
      break;
      
    case 'track_order':
      values.order_number = data.data?.order?.number || data.data?.orderNumber || '';
      values.status = data.data?.order?.status || data.data?.status || '';
      break;
      
    case 'view_cart':
      values.count = data.data?.items?.length || 0;
      values.total = formatPrice(data.data?.total);
      break;
      
    case 'place_order':
      values.order_number = data.data?.order?.number || data.data?.orderNumber || '';
      values.reason = extractErrorReason(data.message);
      break;
      
    case 'cancel_order':
    case 'return_order':
      // Extract order number from message or data
      values.order_number = extractOrderNumber(data.message) || data.data?.orderNumber || '';
      values.reason = extractErrorReason(data.message);
      break;
      
    case 'analytics_query':
      const request = data.data?.request || {};
      const result = data.data?.result || {};
      
      // Format amount
      if (result.value !== undefined) {
        if (result.unit && result.unit !== 'orders') {
          values.amount = `${result.unit} ${result.value.toFixed(2)}`;
        } else {
          values.amount = result.value.toString();
        }
      }
      
      // Format count
      values.count = result.filteredCount || result.value || 0;
      
      // Format filters
      const filterParts = [];
      if (request.filters?.product) filterParts.push(`for ${request.filters.product}`);
      if (request.filters?.category) filterParts.push(`in ${request.filters.category}`);
      if (request.filters?.brand) filterParts.push(`from ${request.filters.brand}`);
      values.filters = filterParts.length > 0 ? filterParts.join(' ') : '';
      
      // Format time range
      values.timeRange = request.dateRange?.label ? request.dateRange.label : '';
      break;
  }
  
  return values;
}

/**
 * Extract error reason from message
 * @param {string} message - Error message
 * @returns {string} Extracted reason
 */
function extractErrorReason(message) {
  if (!message) return '';
  
  // Remove emoji and common prefixes
  return message
    .replace(/^[❌✅🔍📍🛒💰❤️📊😞]+\s*/g, '')
    .replace(/^(Failed to|Cannot|Error:|Oops!|Sorry,)\s*/gi, '')
    .trim();
}

/**
 * Extract order number from message
 * @param {string} message - Message containing order number
 * @returns {string|null} Extracted order number
 */
function extractOrderNumber(message) {
  if (!message) return null;
  
  const match = message.match(/#?([A-Za-z0-9+\/=]+)/);
  return match ? match[1] : null;
}

/**
 * Format price value
 * @param {Object|number} price - Price object or number
 * @returns {string} Formatted price string
 */
function formatPrice(price) {
  if (!price) return '$0.00';
  
  if (typeof price === 'object') {
    const value = price.value || price.amount || 0;
    const currency = price.currency || 'USD';
    return `${currency} ${value.toFixed(2)}`;
  }
  
  return `$${price.toFixed(2)}`;
}

/**
 * Check if response should use natural formatting
 * @param {Object} response - Handler response
 * @returns {boolean} True if should format naturally
 */
export function shouldFormatNaturally(response) {
  // Don't format if displaying UI
  if (response.displayAs === 'ui') {
    return false;
  }
  
  // Don't format if no message
  if (!response.message) {
    return false;
  }
  
  // Format all text responses
  return true;
}
