/**
 * OrderListUI Component
 * Minimal UI component to display customer orders
 */
export default class OrderListUI {
  /**
   * Render orders in a container
   * @param {HTMLElement} container - Container element
   * @param {Array} orders - Array of order objects
   */
  static render(container, orders) {
    console.log('[OrderListUI] Render called with:', { container, orders });
    
    if (!container) {
      console.error('[OrderListUI] Container element not provided');
      return;
    }

    // Clear container
    container.innerHTML = '';

    // Add orders class
    container.classList.add('order-list-ui');

    // Handle empty state
    if (!orders || orders.length === 0) {
      console.log('[OrderListUI] No orders to display');
      container.innerHTML = '<div class="order-list-empty">No orders found</div>';
      return;
    }

    console.log('[OrderListUI] Rendering', orders.length, 'orders');

    // Create orders grid
    const ordersGrid = document.createElement('div');
    ordersGrid.className = 'orders-grid';

    orders.forEach(order => {
      const orderCard = this.createOrderCard(order);
      ordersGrid.appendChild(orderCard);
    });

    container.appendChild(ordersGrid);
    console.log('[OrderListUI] Render complete');
  }

  /**
   * Create an order card element
   * @param {Object} order - Order data
   * @returns {HTMLElement}
   */
  static createOrderCard(order) {
    console.log('[OrderListUI] Creating card for order:', JSON.stringify(order, null, 2));
    
    const card = document.createElement('div');
    card.className = 'order-card';

    // Order number and date
    const header = document.createElement('div');
    header.className = 'order-header';
    
    const orderNumber = document.createElement('div');
    orderNumber.className = 'order-number';
    orderNumber.textContent = `Order #${order.number}`;
    
    const orderDate = document.createElement('div');
    orderDate.className = 'order-date';
    orderDate.textContent = this.formatDate(order.order_date);
    
    header.appendChild(orderNumber);
    header.appendChild(orderDate);

    // Order status
    const status = document.createElement('div');
    status.className = `order-status order-status-${order.status?.toLowerCase() || 'pending'}`;
    status.textContent = order.status || 'Pending';

    // Order items count
    const itemsCount = document.createElement('div');
    itemsCount.className = 'order-items';
    const itemsTotal = order.items?.length || 0;
    itemsCount.textContent = `${itemsTotal} item${itemsTotal !== 1 ? 's' : ''}`;

    // Order total
    const total = document.createElement('div');
    total.className = 'order-total';
    const totalValue = order.total?.grand_total?.value || 0;
    const currency = order.total?.grand_total?.currency || 'USD';
    total.textContent = `${currency} ${totalValue.toFixed(2)}`;

    // Assemble card
    card.appendChild(header);
    card.appendChild(status);
    card.appendChild(itemsCount);
    card.appendChild(total);

    return card;
  }

  /**
   * Format date string
   * @param {string} dateString - Date string
   * @returns {string}
   */
  static formatDate(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  }
}
