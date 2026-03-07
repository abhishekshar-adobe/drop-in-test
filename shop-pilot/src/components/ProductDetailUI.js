/**
 * Product Detail UI Component
 * Displays detailed product information in a formatted card layout
 */

export default class ProductDetailUI {
  /**
   * Render product detail to a container
   * @param {HTMLElement} container - DOM element to render into
   * @param {Object} product - Product data object
   */
  static render(container, product) {
    container.innerHTML = '';
    
    if (!product) {
      container.innerHTML = `
        <div class="product-detail-empty">
          <span class="empty-icon">❌</span>
          <p>Product not found</p>
        </div>
      `;
      return;
    }

    const detailCard = document.createElement('div');
    detailCard.className = 'product-detail-card';

    // Extract product data with fallbacks
    const {
      name = 'Unknown Product',
      sku = '',
      description = '',
      shortDescription = '',
      price = 0,
      specialPrice = null,
      currency = 'USD',
      inStock = true,
      images = [],
      attributes = {},
      rating = null,
      reviewCount = 0
    } = product;

    // Get primary image
    const primaryImage = images && images.length > 0 
      ? (images[0].url || images[0])
      : null;

    // Format price - handle different price formats (number, object, string)
    const priceValue = this.extractPrice(price);
    const specialPriceValue = specialPrice ? this.extractPrice(specialPrice) : null;
    const displayPrice = specialPriceValue || priceValue;
    const hasDiscount = specialPriceValue && specialPriceValue < priceValue;
    
    // Debug logging
    console.log('[ProductDetailUI] Price data:', { price, specialPrice, priceValue, specialPriceValue, displayPrice });

    // Generate star rating
    const starRating = this.generateStarRating(rating, reviewCount);

    // Extract key features from attributes
    const keyFeatures = this.extractKeyFeatures(attributes);

    detailCard.innerHTML = `
      <div class="product-detail-image">
        ${primaryImage 
          ? `<img src="${primaryImage}" alt="${this.escape(name)}" loading="lazy">`
          : '<div class="product-detail-image-placeholder">📦</div>'
        }
      </div>
      
      <div class="product-detail-content">
        <h2 class="product-detail-title">${this.escape(name)}</h2>
        
        ${starRating ? `
          <div class="product-detail-rating">${starRating}</div>
        ` : ''}
        
        <div class="product-detail-price-section">
          <div class="product-detail-price">
            <span class="price-label">Price:</span>
            ${hasDiscount ? `
              <span class="price-original">$${priceValue.toFixed(2)}</span>
              <span class="price-special">$${displayPrice.toFixed(2)}</span>
            ` : `
              <span class="price-current">$${displayPrice.toFixed(2)}</span>
            `}
          </div>
          <div class="product-detail-stock ${inStock ? 'in-stock' : 'out-of-stock'}">
            <span class="stock-label">Stock:</span>
            <span class="stock-status">${inStock ? 'In Stock' : 'Out of Stock'}</span>
          </div>
        </div>
        
        ${shortDescription || description ? `
          <div class="product-detail-description">
            <h3>Description:</h3>
            <p>${this.escape(shortDescription || description)}</p>
          </div>
        ` : ''}
        
        ${keyFeatures.length > 0 ? `
          <div class="product-detail-features">
            <h3>Key Features:</h3>
            <ul class="features-list">
              ${keyFeatures.map(feature => `<li>${this.escape(feature)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        <div class="product-detail-actions">
          <button class="btn-add-to-cart" data-sku="${sku}" ${!inStock ? 'disabled' : ''}>
            🛒 Add to Cart
          </button>
          <button class="btn-add-to-wishlist" data-sku="${sku}">
            ❤️ Add to Wishlist
          </button>
        </div>
        
        <div class="product-detail-meta">
          <span class="meta-sku">SKU: ${sku}</span>
        </div>
      </div>
    `;

    container.appendChild(detailCard);
    
    // Add event listeners for action buttons
    this.attachEventListeners(detailCard, sku);
  }

  /**
   * Generate star rating HTML
   */
  static generateStarRating(rating, reviewCount) {
    if (!rating) return null;
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHtml = '⭐'.repeat(fullStars);
    if (hasHalfStar) starsHtml += '⭐'; // Using full star for simplicity
    starsHtml += '☆'.repeat(emptyStars);
    
    return `${starsHtml} (${rating.toFixed(1)})${reviewCount > 0 ? ` • ${reviewCount} reviews` : ''}`;
  }

  /**
   * Extract key features from product attributes
   */
  static extractKeyFeatures(attributes) {
    if (!attributes || typeof attributes !== 'object') return [];
    
    const features = [];
    const featureKeys = ['processor', 'cpu', 'camera', 'battery', 'display', 'memory', 'storage', 'material', 'color', 'size'];
    
    for (const [key, value] of Object.entries(attributes)) {
      // Check if this is a feature attribute
      const normalizedKey = key.toLowerCase();
      if (featureKeys.some(fk => normalizedKey.includes(fk))) {
        const featureName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const featureValue = Array.isArray(value) ? value.join(', ') : value;
        features.push(`${featureName}: ${featureValue}`);
      }
    }
    
    return features.slice(0, 6); // Limit to 6 key features
  }

  /**
   * Attach event listeners to action buttons
   */
  static attachEventListeners(container, sku) {
    const addToCartBtn = container.querySelector('.btn-add-to-cart');
    const addToWishlistBtn = container.querySelector('.btn-add-to-wishlist');
    
    if (addToCartBtn && !addToCartBtn.disabled) {
      addToCartBtn.addEventListener('click', () => {
        // Trigger the shop-pilot's sendMessage function
        const event = new CustomEvent('shop-pilot-message', {
          detail: { message: `add ${sku} to cart` }
        });
        document.dispatchEvent(event);
      });
    }
    
    if (addToWishlistBtn) {
      addToWishlistBtn.addEventListener('click', () => {
        const event = new CustomEvent('shop-pilot-message', {
          detail: { message: `add ${sku} to wishlist` }
        });
        document.dispatchEvent(event);
      });
    }
  }

  /**
   * Extract numeric price value from various formats
   * @param {number|object|string} price - Price in various formats
   * @returns {number} Numeric price value
   */
  static extractPrice(price) {
    // Handle null/undefined
    if (price === null || price === undefined) {
      return 0;
    }
    
    if (typeof price === 'number') {
      return isNaN(price) ? 0 : price;
    }
    
    if (typeof price === 'object') {
      // Handle price objects like { value: 999, currency: 'USD' } or { amount: 999 }
      // Also handle nested structures
      const extracted = price.value || price.amount || price.regular || price.final || 
                       price.regularPrice?.amount || price.finalPrice?.amount || 0;
      return typeof extracted === 'number' ? extracted : this.extractPrice(extracted);
    }
    
    if (typeof price === 'string') {
      // Parse string price, removing currency symbols
      const numericPrice = parseFloat(price.replace(/[^0-9.-]/g, ''));
      return isNaN(numericPrice) ? 0 : numericPrice;
    }
    
    return 0;
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
