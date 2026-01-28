/**
 * Lightweight Product Card Component
 * Reusable component for displaying individual products
 */
export default class ProductCard {
  /**
   * Create product card HTML
   * @param {Object} product - Product data
   * @param {Function} onSelect - Callback when product is selected
   * @returns {HTMLElement}
   */
  static create(product, onSelect) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.sku = product.sku;
    
    // Determine price and stock status
    const price = product.price || 0;
    const currency = product.currency || 'USD';
    const inStock = product.inStock !== false;
    
    card.innerHTML = `
      <div class="product-card__image">
        ${product.image 
          ? `<img src="${product.image}" alt="${product.name}" loading="lazy">`
          : '<div class="product-card__image-placeholder">📦</div>'
        }
        ${!inStock ? '<span class="product-card__badge product-card__badge--out-of-stock">Out of Stock</span>' : ''}
      </div>
      
      <div class="product-card__content">
        <h3 class="product-card__title">${this.escapeHtml(product.name)}</h3>
        
        <div class="product-card__meta">
          <span class="product-card__sku">SKU: ${product.sku}</span>
          ${product.type ? `<span class="product-card__type">${product.type.replace('ProductView', '')}</span>` : ''}
        </div>
        
        <div class="product-card__footer">
          <div class="product-card__price">
            <span class="product-card__price-currency">${currency}</span>
            <span class="product-card__price-value">${price.toFixed(2)}</span>
          </div>
          
          <button 
            class="product-card__action" 
            ${!inStock ? 'disabled' : ''}
            data-action="select"
          >
            ${inStock ? 'Select' : 'Unavailable'}
          </button>
        </div>
      </div>
    `;
    
    // Add click handlers
    if (inStock && onSelect) {
      const selectBtn = card.querySelector('[data-action="select"]');
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(product);
      });
      
      // Make entire card clickable
      card.addEventListener('click', () => onSelect(product));
    }
    
    return card;
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
