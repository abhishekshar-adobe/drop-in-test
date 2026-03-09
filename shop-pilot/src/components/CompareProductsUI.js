/**
 * Compare Products UI Component
 * Displays two products side by side for comparison
 */

export default class CompareProductsUI {
  /**
   * Render product comparison to a container
   * @param {HTMLElement} container - DOM element to render into
   * @param {Object} data - Object containing product1 and product2
   */
  static render(container, data) {
    container.innerHTML = '';
    
    if (!data || !data.product1 || !data.product2) {
      container.innerHTML = `
        <div class="compare-products-empty">
          <span class="empty-icon">⚖️</span>
          <p>Unable to compare products</p>
        </div>
      `;
      return;
    }

    const { product1, product2 } = data;
    const compareCard = document.createElement('div');
    compareCard.className = 'compare-products-card';

    // Extract product details
    const products = [product1, product2].map(p => ({
      name: p.name || 'Unknown Product',
      sku: p.sku || '',
      image: p.images && p.images.length > 0 ? (p.images[0].url || p.images[0]) : null,
      price: this.extractPrice(p.price),
      specialPrice: p.specialPrice ? this.extractPrice(p.specialPrice) : null,
      inStock: p.inStock !== false,
      description: p.shortDescription || p.description || '',
      attributes: p.attributes || {},
      rating: p.rating || null
    }));

    compareCard.innerHTML = `
      <div class="compare-products-header">
        <h2>Product Comparison</h2>
      </div>
      
      <div class="compare-products-grid">
        <!-- Product 1 Column -->
        <div class="compare-product-column">
          ${this.renderProductColumn(products[0])}
        </div>
        
        <!-- Product 2 Column -->
        <div class="compare-product-column">
          ${this.renderProductColumn(products[1])}
        </div>
      </div>
      
      <div class="compare-products-details">
        ${this.renderComparisonRows(products)}
      </div>
      
      <div class="compare-products-actions">
        <button class="btn-select" data-sku="${products[0].sku}">
          View ${products[0].name}
        </button>
        <button class="btn-select" data-sku="${products[1].sku}">
          View ${products[1].name}
        </button>
      </div>
    `;

    container.appendChild(compareCard);
    
    // Add event listeners
    this.attachEventListeners(compareCard);
  }

  /**
   * Render a product column
   */
  static renderProductColumn(product) {
    const displayPrice = product.specialPrice || product.price;
    const hasDiscount = product.specialPrice && product.specialPrice < product.price;

    return `
      <div class="compare-product-image">
        ${product.image 
          ? `<img src="${product.image}" alt="${this.escape(product.name)}" loading="lazy">`
          : '<div class="compare-product-image-placeholder">📦</div>'
        }
      </div>
      
      <h3 class="compare-product-title">${this.escape(product.name)}</h3>
      
      ${product.rating ? `
        <div class="compare-product-rating">${this.generateStarRating(product.rating)}</div>
      ` : ''}
      
      <div class="compare-product-price">
        ${hasDiscount ? `
          <span class="price-original">$${product.price.toFixed(2)}</span>
          <span class="price-special">$${displayPrice.toFixed(2)}</span>
        ` : `
          <span class="price-current">$${displayPrice.toFixed(2)}</span>
        `}
      </div>
      
      <div class="compare-product-stock ${product.inStock ? 'in-stock' : 'out-of-stock'}">
        ${product.inStock ? '✓ In Stock' : '✗ Out of Stock'}
      </div>
    `;
  }

  /**
   * Render comparison rows
   */
  static renderComparisonRows(products) {
    const rows = [];
    
    // SKU row
    rows.push(`
      <div class="compare-row">
        <div class="compare-label">SKU</div>
        <div class="compare-value">${this.escape(products[0].sku) || '-'}</div>
        <div class="compare-value">${this.escape(products[1].sku) || '-'}</div>
      </div>
    `);
    
    // Description row
    if (products[0].description || products[1].description) {
      rows.push(`
        <div class="compare-row">
          <div class="compare-label">Description</div>
          <div class="compare-value">${this.escape(products[0].description) || '-'}</div>
          <div class="compare-value">${this.escape(products[1].description) || '-'}</div>
        </div>
      `);
    }
    
    // Collect all unique attribute keys and their metadata
    const attributeMap = new Map();
    
    // Process product 1 attributes
    Object.entries(products[0].attributes).forEach(([key, value]) => {
      if (!attributeMap.has(key)) {
        attributeMap.set(key, {
          key,
          label: this.extractAttributeLabel(value, key),
          value1: value,
          value2: products[1].attributes[key] || null
        });
      }
    });
    
    // Process product 2 attributes (in case there are unique ones)
    Object.entries(products[1].attributes).forEach(([key, value]) => {
      if (!attributeMap.has(key)) {
        attributeMap.set(key, {
          key,
          label: this.extractAttributeLabel(value, key),
          value1: products[0].attributes[key] || null,
          value2: value
        });
      }
    });
    
    // Render attribute rows
    Array.from(attributeMap.values()).forEach(attr => {
      const formattedValue1 = this.formatAttributeValue(attr.value1);
      const formattedValue2 = this.formatAttributeValue(attr.value2);
      
      rows.push(`
        <div class="compare-row">
          <div class="compare-label">${this.escape(attr.label)}</div>
          <div class="compare-value ${this.shouldHighlight(formattedValue1, formattedValue2, true) ? 'highlight' : ''}">${formattedValue1}</div>
          <div class="compare-value ${this.shouldHighlight(formattedValue1, formattedValue2, false) ? 'highlight' : ''}">${formattedValue2}</div>
        </div>
      `);
    });
    
    return rows.join('');
  }

  /**
   * Extract label from attribute object or generate from key
   */
  static extractAttributeLabel(attributeValue, fallbackKey) {
    // If it's an object with a label property, use it
    if (attributeValue && typeof attributeValue === 'object') {
      if (attributeValue.label) {
        return attributeValue.label;
      }
      
      // If it's an array of objects with labels, use the first one's label
      if (Array.isArray(attributeValue) && attributeValue.length > 0 && attributeValue[0].label) {
        return attributeValue[0].label;
      }
    }
    
    // Fall back to formatting the key name
    return fallbackKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Format attribute value for display
   */
  static formatAttributeValue(value) {
    if (!value) return '-';
    
    // Handle arrays
    if (Array.isArray(value)) {
      // If array of objects with 'value' property, extract those values
      if (value.length > 0 && typeof value[0] === 'object' && value[0].value !== undefined) {
        const extracted = value.map(item => this.extractValueFromObject(item)).filter(v => v !== '-');
        return extracted.length > 0 ? extracted.join(', ') : '-';
      }
      // Regular array of primitives
      const filtered = value.filter(v => v !== null && v !== undefined);
      return filtered.length > 0 ? filtered.join(', ') : '-';
    }
    
    // Handle objects (like Adobe Commerce attribute objects)
    if (typeof value === 'object') {
      return this.extractValueFromObject(value);
    }
    
    return String(value);
  }
  
  /**
   * Extract the actual value from an attribute object
   * Adobe Commerce attributes often come as {name, label, value, roles}
   */
  static extractValueFromObject(obj) {
    if (!obj || typeof obj !== 'object') return '-';
    
    // Check for value property
    if (obj.value !== undefined && obj.value !== null) {
      return String(obj.value);
    }
    
    // Check for label (fallback)
    if (obj.label) {
      return obj.label;
    }
    
    // Check for name (fallback)
    if (obj.name) {
      return obj.name;
    }
    
    // If it's a complex object, try to find something meaningful
    const keys = Object.keys(obj);
    if (keys.length === 1) {
      return String(obj[keys[0]]);
    }
    
    // Last resort - return first non-object value
    for (const key of keys) {
      const val = obj[key];
      if (typeof val !== 'object' && val !== null && val !== undefined) {
        return String(val);
      }
    }
    
    return '-';
  }

  /**
   * Determine if a value should be highlighted (better than the other)
   */
  static shouldHighlight(value1, value2, isFirst) {
    // Extract numeric values if they're formatted strings
    const num1 = this.extractNumericValue(value1);
    const num2 = this.extractNumericValue(value2);
    
    if (num1 !== null && num2 !== null) {
      return isFirst ? (num1 > num2) : (num2 > num1);
    }
    
    return false;
  }
  
  /**
   * Extract numeric value from formatted attribute value
   */
  static extractNumericValue(value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return null;
    
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Generate star rating HTML
   */
  static generateStarRating(rating) {
    if (!rating) return '';
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHtml = '⭐'.repeat(fullStars);
    if (hasHalfStar) starsHtml += '⭐';
    starsHtml += '☆'.repeat(emptyStars);
    
    return `${starsHtml} (${rating.toFixed(1)})`;
  }

  /**
   * Extract numeric price value from various formats
   */
  static extractPrice(price) {
    if (price === null || price === undefined) return 0;
    if (typeof price === 'number') return isNaN(price) ? 0 : price;
    
    if (typeof price === 'object') {
      const extracted = price.value || price.amount || price.regular || price.final || 
                       price.regularPrice?.amount || price.finalPrice?.amount || 0;
      return typeof extracted === 'number' ? extracted : this.extractPrice(extracted);
    }
    
    if (typeof price === 'string') {
      const numericPrice = parseFloat(price.replace(/[^0-9.-]/g, ''));
      return isNaN(numericPrice) ? 0 : numericPrice;
    }
    
    return 0;
  }

  /**
   * Attach event listeners
   */
  static attachEventListeners(container) {
    const selectButtons = container.querySelectorAll('.btn-select');
    
    selectButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.dataset.sku;
        const event = new CustomEvent('shop-pilot-message', {
          detail: { message: `show details of ${sku}` }
        });
        document.dispatchEvent(event);
      });
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  static escape(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
