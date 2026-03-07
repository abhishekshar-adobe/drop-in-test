/**
 * CartUI Component
 * Displays cart items in a clean, visual format
 */
export default class CartUI {
  /**
   * Render cart items in a container
   * @param {HTMLElement} container - Container element
   * @param {Object} cart - Cart data object
   */
  static render(container, cart) {
    if (!container) {
      console.error('[CartUI] Container element not provided');
      return;
    }

    // Clear container
    container.innerHTML = '';
    container.classList.add('cart-ui');

    // Handle empty state
    if (!cart || !cart.items || cart.items.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <span class="empty-icon">🛒</span>
          <h3>Your cart is empty</h3>
          <p>Start shopping to add items!</p>
        </div>
      `;
      return;
    }

    // Create cart container
    const cartContainer = document.createElement('div');
    cartContainer.className = 'cart-container';

    // Cart header
    const header = document.createElement('div');
    header.className = 'cart-header';
    const itemCount = cart.totalQuantity || cart.items?.length || 0;
    header.innerHTML = `
      <h3>🛒 Your Cart (${itemCount} item${itemCount !== 1 ? 's' : ''})</h3>
    `;
    cartContainer.appendChild(header);

    // Cart items
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'cart-items';

    cart.items.forEach((item, index) => {
      const itemCard = this.createCartItemCard(item, index + 1);
      itemsContainer.appendChild(itemCard);
    });

    cartContainer.appendChild(itemsContainer);

    // Cart summary
    const summary = this.createCartSummary(cart);
    cartContainer.appendChild(summary);

    container.appendChild(cartContainer);
  }

  /**
   * Create a cart item card
   * @param {Object} item - Cart item data
   * @param {Number} index - Item number
   * @returns {HTMLElement}
   */
  static createCartItemCard(item, index) {
    const card = document.createElement('div');
    card.className = 'cart-item-card';

    // Debug: Log the item structure
    console.log('[CartUI] Item structure:', JSON.stringify(item, null, 2));

    // Extract item details using CartModel interface structure
    const itemName = item.name || 'Unknown Product';
    const itemPrice = item.price?.value || 0;
    const itemTotal = item.rowTotal?.value || 0;
    const quantity = item.quantity || 1;
    const imageUrl = item.image?.src || '';
    const sku = item.sku || '';
    const currency = item.price?.currency || 'USD';

    console.log('[CartUI] Extracted values:', {
      itemName,
      itemPrice,
      itemTotal,
      quantity,
      imageUrl,
      sku,
      currency
    });

    // Format currency value
    const formatPrice = (value) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(value);
    };

    card.innerHTML = `
      <div class="cart-item-number">${index}</div>
      
      ${imageUrl ? `
        <div class="cart-item-image">
          <img src="${imageUrl}" alt="${this.escape(itemName)}" loading="lazy">
        </div>
      ` : `
        <div class="cart-item-image-placeholder">📦</div>
      `}
      
      <div class="cart-item-details">
        <h4 class="cart-item-name">${this.escape(itemName)}</h4>
        <p class="cart-item-sku">SKU: ${this.escape(sku)}</p>
        <div class="cart-item-price-info">
          <span class="item-price">${formatPrice(itemPrice)}</span>
          <span class="item-quantity">× ${quantity}</span>
        </div>
      </div>
      
      <div class="cart-item-total">
        <span class="total-label">Subtotal</span>
        <span class="total-amount">${formatPrice(itemTotal)}</span>
      </div>
    `;

    return card;
  }

  /**
   * Create cart summary
   * @param {Object} cart - Cart data
   * @returns {HTMLElement}
   */
  static createCartSummary(cart) {
    const summary = document.createElement('div');
    summary.className = 'cart-summary';

    console.log('[CartUI] Cart summary data:', {
      subtotal: cart.subtotal,
      total: cart.total,
      itemCount: cart.totalQuantity
    });

    // Get values from CartModel structure
    const subtotal = cart.subtotal?.excludingTax?.value || 0;
    const total = cart.total?.includingTax?.value || 0;
    const currency = cart.total?.includingTax?.currency || 'USD';

    // Format currency
    const formatPrice = (value) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(value);
    };

    summary.innerHTML = `
      <div class="summary-row">
        <span class="summary-label">Subtotal:</span>
        <span class="summary-value">${formatPrice(subtotal)}</span>
      </div>
      <div class="summary-row total-row">
        <span class="summary-label">Total:</span>
        <span class="summary-value">${formatPrice(total)}</span>
      </div>
    `;

    return summary;
  }

  /**
   * Escape HTML special characters
   * @param {String} text - Text to escape
   * @returns {String}
   */
  static escape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
