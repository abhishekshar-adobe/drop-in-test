import ProductCard from './ProductCard.js';

/**
 * Lightweight Product List Component
 * Displays multiple products in a grid with pagination
 */
export default class ProductList {
  constructor(container, options = {}) {
    this.container = container;
    this.products = [];
    this.currentPage = 1;
    this.itemsPerPage = options.itemsPerPage || 12;
    this.onSelect = options.onSelect || null;
    this.layout = options.layout || 'grid'; // 'grid' or 'list'
  }
  
  /**
   * Render product list
   * @param {Array} products - Array of product objects
   * @param {Object} pageInfo - Pagination info
   */
  render(products, pageInfo = null) {
    this.products = products;
    this.container.innerHTML = '';
    this.container.className = `product-list product-list--${this.layout}`;
    
    if (!products || products.length === 0) {
      this.renderEmpty();
      return;
    }
    
    // Header with count
    const header = this.createHeader(products.length, pageInfo);
    this.container.appendChild(header);
    
    // Product grid
    const grid = document.createElement('div');
    grid.className = 'product-list__grid';
    
    products.forEach((product, index) => {
      const card = ProductCard.create(product, (selectedProduct) => {
        if (this.onSelect) {
          this.onSelect(selectedProduct, index);
        }
      });
      grid.appendChild(card);
    });
    
    this.container.appendChild(grid);
    
    // Pagination
    if (pageInfo && pageInfo.total_pages > 1) {
      const pagination = this.createPagination(pageInfo);
      this.container.appendChild(pagination);
    }
  }
  
  /**
   * Create header with product count and filters
   */
  createHeader(count, pageInfo) {
    const header = document.createElement('div');
    header.className = 'product-list__header';
    
    const totalCount = pageInfo?.total_count || count;
    
    header.innerHTML = `
      <div class="product-list__count">
        <strong>${totalCount}</strong> ${totalCount === 1 ? 'product' : 'products'} found
      </div>
      <div class="product-list__actions">
        <button class="product-list__view-toggle" data-view="grid" title="Grid view">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z"/>
          </svg>
        </button>
        <button class="product-list__view-toggle" data-view="list" title="List view">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z"/>
          </svg>
        </button>
      </div>
    `;
    
    // View toggle handlers
    const toggleButtons = header.querySelectorAll('.product-list__view-toggle');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.setLayout(view);
      });
      
      if (btn.dataset.view === this.layout) {
        btn.classList.add('active');
      }
    });
    
    return header;
  }
  
  /**
   * Create pagination controls
   */
  createPagination(pageInfo) {
    const pagination = document.createElement('div');
    pagination.className = 'product-list__pagination';
    
    const { current_page, total_pages } = pageInfo;
    
    pagination.innerHTML = `
      <button 
        class="product-list__page-btn" 
        data-page="prev"
        ${current_page <= 1 ? 'disabled' : ''}
      >
        ‹ Previous
      </button>
      
      <span class="product-list__page-info">
        Page ${current_page} of ${total_pages}
      </span>
      
      <button 
        class="product-list__page-btn" 
        data-page="next"
        ${current_page >= total_pages ? 'disabled' : ''}
      >
        Next ›
      </button>
    `;
    
    return pagination;
  }
  
  /**
   * Render empty state
   */
  renderEmpty() {
    this.container.innerHTML = `
      <div class="product-list__empty">
        <div class="product-list__empty-icon">🔍</div>
        <h3>No products found</h3>
        <p>Try adjusting your search or filters</p>
      </div>
    `;
  }
  
  /**
   * Set layout mode
   */
  setLayout(layout) {
    this.layout = layout;
    this.container.className = `product-list product-list--${layout}`;
    
    // Update active toggle button
    const toggleButtons = this.container.querySelectorAll('.product-list__view-toggle');
    toggleButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === layout);
    });
  }
  
  /**
   * Update products without full re-render
   */
  update(products) {
    this.products = products;
    const grid = this.container.querySelector('.product-list__grid');
    if (grid) {
      grid.innerHTML = '';
      products.forEach((product, index) => {
        const card = ProductCard.create(product, (selectedProduct) => {
          if (this.onSelect) {
            this.onSelect(selectedProduct, index);
          }
        });
        grid.appendChild(card);
      });
    }
  }
  
  /**
   * Destroy component
   */
  destroy() {
    this.container.innerHTML = '';
    this.products = [];
  }
}
