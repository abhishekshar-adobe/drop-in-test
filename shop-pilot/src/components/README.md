# Product List Component

Lightweight, reusable product display components for Shop Pilot chatbot.

## Components

### 1. ProductCard
Individual product card with image, title, price, and action button.

### 2. ProductList
Container for multiple products with grid/list view toggle and pagination.

## Features

- ✅ **Lightweight** - Pure vanilla JS, no framework dependencies
- ✅ **Reusable** - Easy to integrate anywhere
- ✅ **Responsive** - Mobile-first design
- ✅ **Flexible Layouts** - Grid and list views
- ✅ **Pagination** - Built-in page navigation
- ✅ **Click Handlers** - Product selection callbacks
- ✅ **Stock Status** - Visual indicators for availability
- ✅ **Empty State** - Graceful no-results display

## Usage

### Basic Example

```javascript
import ProductList from './src/components/ProductList.js';

// Initialize
const container = document.getElementById('product-container');
const productList = new ProductList(container, {
  layout: 'grid', // or 'list'
  itemsPerPage: 12,
  onSelect: (product, index) => {
    console.log('Selected:', product);
  }
});

// Render products
productList.render(products, pageInfo);
```

### With Real API

```javascript
import EcommerceAPI from './src/actions/ecommerceApi.js';
import ProductList from './src/components/ProductList.js';

const api = new EcommerceAPI();
const productList = new ProductList(container, {
  onSelect: (product) => {
    // Add to cart, view details, etc.
    console.log('Selected SKU:', product.sku);
  }
});

// Search and display
const result = await api.searchProducts('shirt', { color: 'blue' });
productList.render(result.items, result.pageInfo);
```

### Product Data Structure

```javascript
{
  sku: 'PROD-001',
  name: 'Product Name',
  price: 29.99,
  currency: 'USD',
  inStock: true,
  image: 'https://example.com/image.jpg', // optional
  type: 'SimpleProductView' // optional
}
```

## API

### ProductList Constructor

```javascript
new ProductList(container, options)
```

**Parameters:**
- `container` (HTMLElement) - DOM element to render into
- `options` (Object):
  - `layout` (string) - 'grid' or 'list' (default: 'grid')
  - `itemsPerPage` (number) - Items per page (default: 12)
  - `onSelect` (function) - Callback when product selected

### Methods

#### render(products, pageInfo)
Render product list with optional pagination.

```javascript
productList.render(products, {
  current_page: 1,
  page_size: 12,
  total_pages: 5,
  total_count: 48
});
```

#### update(products)
Update products without full re-render.

```javascript
productList.update(newProducts);
```

#### setLayout(layout)
Switch between grid and list view.

```javascript
productList.setLayout('list');
```

#### destroy()
Clean up and remove all content.

```javascript
productList.destroy();
```

## Styling

Import the CSS file:

```html
<link rel="stylesheet" href="./src/components/product-list.css">
```

### Customization

Override CSS variables for easy theming:

```css
.product-card {
  --card-bg: #fff;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  --primary-color: #667eea;
}
```

## Demo

View the demo at `demo/product-list-demo.html`:

```bash
# Serve the shop-pilot directory
npx serve .

# Open http://localhost:3000/demo/product-list-demo.html
```

## Integration with Chatbot

### In shop-pilot block:

```javascript
import ProductList from '../../shop-pilot/src/components/ProductList.js';

// Inside your chatbot response handler
function displayProducts(products, pageInfo) {
  const container = document.createElement('div');
  container.className = 'chat-product-list';
  
  const productList = new ProductList(container, {
    layout: 'grid',
    onSelect: (product) => {
      // Add to cart action
      sendMessage(`add ${product.sku} to cart`);
    }
  });
  
  productList.render(products, pageInfo);
  messagesContainer.appendChild(container);
}
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS 14+, Android 10+)

## Performance

- Lazy image loading
- Event delegation for click handlers
- Minimal DOM manipulation
- CSS-only animations
- ~2KB CSS + ~3KB JS (minified)

## Examples

### Example 1: Search Results

```javascript
const result = await api.searchProducts('blue shirt');
productList.render(result.items, result.pageInfo);
```

### Example 2: Filtered Products

```javascript
const result = await api.searchProducts('', {
  color: 'blue',
  size: 'l'
});
productList.render(result.items);
```

### Example 3: Grid to List Toggle

```javascript
document.getElementById('toggle-view').addEventListener('click', () => {
  const newLayout = productList.layout === 'grid' ? 'list' : 'grid';
  productList.setLayout(newLayout);
});
```

## License

MIT
