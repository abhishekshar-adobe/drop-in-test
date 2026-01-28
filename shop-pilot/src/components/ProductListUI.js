/**
 * Minimal Product List UI Component
 * Displays products in a simple grid - lightweight and reusable
 */

export default class ProductListUI {
  /**
   * Render products to a container
   * @param {HTMLElement} container - DOM element to render into
   * @param {Array} products - Array of product objects
   * @param {Function} onSelect - Optional callback when product is clicked
   */
  static render(container, products, onSelect) {
    container.innerHTML = '';
    
    if (!products || products.length === 0) {
      container.innerHTML = `
        <div class="product-list-empty">
          <span class="empty-icon">🔍</span>
          <p>No products found</p>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'product-grid';

    products.forEach((product, index) => {
      const card = this.createProductCard(product, index + 1, onSelect);
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  /**
   * Create a single product card
   */
  static createProductCard(product, number, onSelect) {
    const card = document.createElement('div');
    card.className = 'product-item';
    card.setAttribute('data-number', number);
    
    const price = product.price || 0;
    const inStock = product.inStock !== false;

    card.innerHTML = `
      <div class="product-number">${number}</div>
      ${product.image ? `
        <img class="product-image" src="${product.image}" alt="${this.escape(product.name)}" loading="lazy">
      ` : `
        <div class="product-image-placeholder">📦</div>
      `}
      
      <div class="product-info">
        <h4 class="product-name">${this.escape(product.name)}</h4>
        <p class="product-sku">${product.sku}</p>
        <div class="product-footer">
          <span class="product-price">$${price.toFixed(2)}</span>
          ${!inStock ? '<span class="out-of-stock">Out of Stock</span>' : ''}
        </div>
      </div>
    `;

    if (inStock && onSelect) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => onSelect(product, number));
    } else if (!inStock) {
      card.classList.add('unavailable');
    }

    return card;
  }

  /**
   * Escape HTML
   */
  static escape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
