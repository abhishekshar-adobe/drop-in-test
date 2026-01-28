# Shop Pilot Test Suite

Comprehensive test coverage for the AI-powered e-commerce chatbot NLP system.

## Test Coverage

### 1. **Detected Intent**
Tests verify that the correct intent is identified from user input:
- `product_search` - Searching for products
- `add_to_cart` - Adding items to shopping cart
- `add_to_wishlist` - Saving items to wishlist
- `check_price` - Checking product prices
- `view_orders` - Viewing order history
- `track_order` - Tracking order status
- `view_cart` - Viewing shopping cart

### 2. **Confidence Score**
Tests validate that confidence scoring works correctly:
- High confidence (>0.7) for clear queries
- Per-intent confidence thresholds respected
- Low confidence triggers clarification flow

### 3. **Extracted Slots**
Tests ensure proper entity extraction:
- **Product names**: shirt, jacket, shoes, etc.
- **Attributes**: 
  - Color (blue, red, black) with synonym normalization
  - Size (xs, s, m, l, xl) with typo handling
  - Material (cotton, leather, denim)
- **Quantities**: Numeric values (1, 2, 5, etc.)
- **Order numbers**: For tracking orders

### 4. **Expected Action**
Tests verify correct action execution:
- Required slots validation
- Priority-based intent resolution
- Multi-intent handling

## Running Tests

```bash
# Install dependencies
cd shop-pilot
npm install

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once (CI mode)
npm run test:run
```

## Test Structure

### Product Search Tests
- Basic search queries
- Entity normalization (typos, synonyms)
- Attribute extraction (color, size, material)

### Add to Cart Tests
- Intent detection with SKU requirement
- Quantity extraction
- Multi-attribute products

### Multi-Intent Tests
- Compound queries ("show blue shirt and add to cart")
- Intent prioritization

### Disambiguation Tests
- Prevents false positives ("show cap" ≠ "show orders")
- Multi-word pattern matching
- Priority-based conflict resolution

### Edge Cases
- Empty input
- Gibberish input
- Mixed case handling
- Missing required slots

## Test Results Format

Each test validates:
1. ✅ **Intent Name** - Correct intent detected
2. ✅ **Confidence** - Meets threshold requirements
3. ✅ **Entities** - All slots extracted correctly
4. ✅ **Action** - Expected behavior triggered

## Example Test Case

```javascript
Input: "show blue larg shirt"

Expected:
1. Detected Intent: product_search
2. Confidence Score: 0.85 (high)
3. Extracted Slots:
   - query: "blue l shirt"
   - attributes: { color: "blue", size: "l" }
4. Expected Action: Execute product search API call
```

## Coverage Goals

- Intent Detection: >95%
- Entity Extraction: >90%
- Confidence Scoring: >90%
- Action Execution: >85%
