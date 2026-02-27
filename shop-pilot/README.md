# Shop Pilot - AI E-commerce Chatbot

Multi-layer NLP architecture for intelligent e-commerce conversations with natural language generation.

## Architecture Flow

```
User Input → Tokenizer → DLM → Intent Detector → Confidence Scorer
                                                        ↓
                                    High → Executor → E-commerce API
                                       ↓                ↓
                                       ↓     Natural Response Formatter
                                       ↓                ↓
                                    Low → Clarification → User
```

## Features

### Core NLP
- **Multi-Intent Detection**: Handle complex queries with multiple intents ("show cap and add 1 to cart")
- **Entity Extraction**: Products, quantities, prices, attributes, order numbers, reasons, time ranges
- **Confidence Scoring**: Smart clarification when uncertain, no penalty for optional entities
- **Fuzzy Matching**: Typo correction and synonym handling
- **Domain Language Model**: E-commerce specialized NLP with base64 order ID support

### E-commerce Capabilities
- **Product Operations**: Search, add to cart, add to wishlist, check price
- **Order Management**: View orders, track order, cancel order, return order, place order
- **Analytics Queries**: Config-driven analytics with metric detection (count, sum, avg, max, min, top, list)
  - Time range extraction ("last year", "this month", "last 30 days")
  - Automatic filtering by product, category, brand
  - Generic aggregation executor for all metrics
  
### Natural Language Generation
- **Response Formatter**: Template-based NLG for conversational responses (text-only)
- **Multiple Variations**: Randomized phrasings for natural feel
- **Context-Aware**: Different templates for success/error/empty states
- **Smart Formatting**: Only applied when `displayAs !== 'ui'`

## Quick Start

```javascript
import ShopPilot from './src/index.js';

const bot = new ShopPilot();

// Product search
const response1 = await bot.process("search for red shoes size 10");

// Multi-intent
const response2 = await bot.process("show cap and add 1 to cart");

// Order management
const response3 = await bot.process("cancel order 000005915 reason changed mind");

// Analytics
const response4 = await bot.process("how much did I spend on shoes last year?");

console.log(response.message);
```

## Supported Intents

| Intent | Example | Required Slots | Display Mode |
|--------|---------|----------------|--------------|
| `product_search` | "show me red shoes" | query | UI (Product Grid) |
| `add_to_cart` | "add to cart" | sku | Text (Confirmation) |
| `add_to_wishlist` | "add to wishlist" | sku | Text (Confirmation) |
| `check_price` | "how much is this" | product | Text (Price) |
| `view_orders` | "my orders" | - | UI (Order List) |
| `track_order` | "track order 123" | order_number | Text (Status) |
| `view_cart` | "show cart" | - | Text (Summary) |
| `place_order` | "checkout" | - | Text (Confirmation) |
| `cancel_order` | "cancel order 123 reason mistake" | order_number, reason | Text (Confirmation) |
| `return_order` | "return order 123 reason defective" | order_number, reason | Text (Confirmation) |
| `reset_cart` | "clear my cart" | - | Text (Confirmation) |
| `analytics_query` | "total spend this year" | - | Text/UI (Metric-dependent) |

## Analytics Query Examples

```javascript
// Count queries
"how many orders did I place this month?"
"count of orders for shoes"

// Sum queries  
"how much did I spend on shoes last year?"
"total amount order this year"

// Average queries
"what's my average order value?"
"average spend on electronics"

// Max/Min queries
"my most expensive order"
"cheapest order last month"

// Top/List queries (displays UI)
"show me top 5 orders"
"list all orders for Nike"
```

## Configuration

Edit `config/config.js` to adjust:
- Confidence thresholds (high: 0.7, low: 0.4)
- API endpoints
- NLP parameters
- Logging level

Edit `config/intents.json` to:
- Add new intent patterns
- Configure entity types
- Set required slots
- Adjust priorities and thresholds

## Project Structure

```
shop-pilot/
├── src/
│   ├── index.js                 # Main orchestrator with slot validation
│   ├── nlp/
│   │   ├── dlm.js              # Domain Language Model (entity extraction)
│   │   ├── intentDetector.js   # Multi-intent detection with entity mapping
│   │   ├── confidence.js       # Confidence scoring (slot-aware)
│   │   └── clarification.js    # Clarification generator
│   ├── actions/
│   │   ├── executor.js         # Action executor with NLG integration
│   │   └── ecommerceApi.js     # Adobe Commerce API wrapper
│   ├── utils/
│   │   ├── analytics.js        # Analytics metric detection & aggregation
│   │   ├── responseFormatter.js # Natural language response templates
│   │   ├── tokenizer.js        # Text tokenization
│   │   └── logger.js           # Logging utility
│   └── components/
│       ├── ProductListUI.js    # Product grid renderer
│       └── OrderListUI.js      # Order list renderer
├── config/
│   ├── config.js               # App configuration
│   └── intents.json            # Intent definitions & patterns
└── examples/
    └── analytics-example.js    # End-to-end analytics demo
```

## Key Implementation Details

### Multi-Intent Processing
The system can detect and execute multiple intents in a single query:
1. Detects all intents above confidence threshold
2. Generates processing steps for UI visualization
3. Executes intents sequentially
4. Auto-completes "show X and add Y to cart" pattern

### Entity Extraction
- **Order IDs**: Supports numeric (000005915) and base64 (NTkwNg==) formats
- **Products**: Fuzzy matching against vocabulary
- **Time Ranges**: Pattern-based extraction for relative dates
- **Quantities**: Preserves leading zeros, distinguishes from product selection numbers
- **Reasons**: Keyword-based and fallback text extraction

### Confidence Scoring
- No penalty for optional entities (intents without required slots)
- Slot presence check reduces confidence if required slots missing
- Entity quality assessment only for required slots
- Confidence levels: high (≥0.7), medium (0.4-0.7), low (<0.4)

### Natural Response Formatting
Templates stored in `responseFormatter.js` with variations like:
- `add_to_cart`: ["✅ Added {product} to your cart!", "✅ Got it! {product} is now in your cart."]
- `analytics_query`: ["📊 You spent {amount} on {filters} {timeRange}"]

Only applies when `displayAs !== 'ui'` to preserve UI rendering for product/order lists.

### Analytics System
Config-driven approach with:
1. **Metric Detection**: Pattern matching for count/sum/avg/max/min/top/list
2. **Request Builder**: Structured analytics request object
3. **Generic Aggregator**: Single function handles all metrics via switch statement
4. **Result Formatter**: Natural language output with filter context

No intent-specific code - add new metrics by updating patterns only!

## Testing

Run tests:
```bash
cd shop-pilot
npm test
```

See `examples/analytics-example.js` for end-to-end analytics demo.

## Recent Updates (Feb 2026)

- ✅ Added `analytics_query` intent with config-driven metric detection
- ✅ Implemented Natural Response Formatter layer (NLG)
- ✅ Fixed confidence scoring for intents with optional entities
- ✅ Enhanced order ID extraction for base64 format
- ✅ Added multi-intent processing steps visualization
- ✅ Improved slot validation with auto-completion flow
- ✅ Added `reset_cart` intent for clear/empty/reset cart operations
