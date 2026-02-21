/**
 * End-to-End Example: "How much did I spend on shoes last year?"
 * This demonstrates the complete analytics_query flow.
 */

// ============================================
// 1. USER INPUT
// ============================================
const userInput = "How much did I spend on shoes last year?";

// ============================================
// 2. DLM PROCESSING
// ============================================
// The Domain Language Model extracts:
// - Tokens: ["how", "much", "did", "i", "spend", "on", "shoes", "last", "year"]
// - Products: ["shoes"]
// - Verbs: ["spend"]
// - Numbers: []

// ============================================
// 3. INTENT DETECTION
// ============================================
// IntentDetector matches patterns:
// - Pattern "how much" matches analytics_query
// - Entities extracted:
//   {
//     product: "shoes",
//     category: null,
//     brand: null,
//     time_range: null,  // Will be extracted by analytics utils
//     metric: null       // Will be detected by analytics utils
//   }

// ============================================
// 4. METRIC DETECTION
// ============================================
import { detectMetric } from './src/utils/analytics.js';

const metricInfo = detectMetric(userInput);
// Returns: { metric: 'sum', field: 'total' }
// Because "how much" and "spend" indicate sum operation

// ============================================
// 5. TIME RANGE EXTRACTION
// ============================================
import { extractTimeRange } from './src/utils/analytics.js';

const timeRange = extractTimeRange(userInput);
// Returns:
// {
//   start: Date('2025-01-01T00:00:00.000Z'),
//   end: Date('2025-12-31T23:59:59.999Z'),
//   label: 'last year'
// }

// ============================================
// 6. BUILD ANALYTICS REQUEST
// ============================================
import { buildAnalyticsRequest } from './src/utils/analytics.js';

const request = buildAnalyticsRequest({
  text: userInput,
  metric: 'sum',
  field: 'total',
  product: 'shoes',
  category: null,
  brand: null,
  timeRange
});

// Returns:
// {
//   dataset: 'orders',
//   metric: 'sum',
//   field: 'total',
//   filters: {
//     product: 'shoes'
//   },
//   dateRange: {
//     start: '2025-01-01T00:00:00.000Z',
//     end: '2025-12-31T23:59:59.999Z',
//     label: 'last year'
//   },
//   originalQuery: 'How much did I spend on shoes last year?'
// }

// ============================================
// 7. FETCH ORDER DATA
// ============================================
// Example order data from Adobe Commerce API
const orders = [
  {
    number: "000005915",
    id: "NTkwNg==",
    order_date: "2025-03-15T10:30:00Z",
    status: "complete",
    total: {
      grand_total: {
        value: 129.99,
        currency: "USD"
      }
    },
    items: [
      {
        product_name: "Running Shoes",
        product_sku: "RS-001",
        category: "Footwear",
        quantity_ordered: 1,
        product_sale_price: {
          value: 129.99,
          currency: "USD"
        }
      }
    ]
  },
  {
    number: "000005920",
    id: "NTkxMA==",
    order_date: "2025-07-22T14:20:00Z",
    status: "complete",
    total: {
      grand_total: {
        value: 89.99,
        currency: "USD"
      }
    },
    items: [
      {
        product_name: "Canvas Shoes",
        product_sku: "CS-002",
        category: "Footwear",
        quantity_ordered: 1,
        product_sale_price: {
          value: 89.99,
          currency: "USD"
        }
      }
    ]
  },
  {
    number: "000005925",
    id: "NTkxNQ==",
    order_date: "2025-11-10T09:45:00Z",
    status: "complete",
    total: {
      grand_total: {
        value: 159.99,
        currency: "USD"
      }
    },
    items: [
      {
        product_name: "Winter Boots",
        product_sku: "WB-003",
        category: "Footwear",
        quantity_ordered: 1,
        product_sale_price: {
          value: 159.99,
          currency: "USD"
        }
      }
    ]
  },
  {
    number: "000005930",
    id: "NTkyMA==",
    order_date: "2024-05-18T16:00:00Z", // Last year - out of range
    status: "complete",
    total: {
      grand_total: {
        value: 99.99,
        currency: "USD"
      }
    },
    items: [
      {
        product_name: "Summer Sandals",
        product_sku: "SS-004",
        category: "Footwear",
        quantity_ordered: 1,
        product_sale_price: {
          value: 99.99,
          currency: "USD"
        }
      }
    ]
  }
];

// ============================================
// 8. EXECUTE AGGREGATION
// ============================================
import { executeAggregation } from './src/utils/analytics.js';

const result = executeAggregation(request, orders);

// Processing steps:
// 1. Filter by date range (2025-01-01 to 2025-12-31)
//    - Keeps: 000005915, 000005920, 000005925
//    - Removes: 000005930 (2024)
//
// 2. Filter by product "shoes"
//    - Matches items with "shoes" in product_name
//    - All 3 orders contain shoes in their items
//
// 3. Execute sum aggregation
//    - Sum of grand_total values: 129.99 + 89.99 + 159.99 = 379.97
//
// Returns:
// {
//   value: 379.97,
//   label: 'Total Spend',
//   unit: 'USD',
//   filteredCount: 3,
//   totalCount: 4
// }

// ============================================
// 9. FORMAT RESULT
// ============================================
import { formatAnalyticsResult } from './src/utils/analytics.js';

const message = formatAnalyticsResult(request, result);

// Returns:
// "📊 **Analytics Result**
//
// **Filters:** product: shoes, time: last year
//
// **Total Spend:** USD 379.97"

// ============================================
// 10. FINAL RESPONSE
// ============================================
const response = {
  success: true,
  intent: 'analytics_query',
  message: message,
  displayAs: 'text',
  data: {
    request: request,
    result: result,
    orders: []  // Empty for sum/count/avg, populated for list/top
  }
};

console.log('='.repeat(50));
console.log('ANALYTICS QUERY EXAMPLE');
console.log('='.repeat(50));
console.log('\nUser Input:', userInput);
console.log('\nMetric Detected:', metricInfo);
console.log('\nTime Range:', timeRange);
console.log('\nAnalytics Request:', JSON.stringify(request, null, 2));
console.log('\nAggregation Result:', JSON.stringify(result, null, 2));
console.log('\nFormatted Message:\n', message);
console.log('\nFinal Response:', JSON.stringify(response, null, 2));
console.log('='.repeat(50));

// ============================================
// OTHER EXAMPLE QUERIES
// ============================================

/*
Example 1: "How many orders did I place this month?"
- Metric: count
- Time Range: this month
- Result: "Count: 12 orders"

Example 2: "What's the average order value for electronics?"
- Metric: avg
- Category: electronics
- Result: "Average: USD 245.67"

Example 3: "Show me my top 5 orders last year"
- Metric: top
- Time Range: last year
- Result: List of 5 highest value orders (displayAs: 'ui')

Example 4: "List all orders for Nike shoes"
- Metric: list
- Product: shoes
- Brand: Nike
- Result: Filtered order list (displayAs: 'ui')

Example 5: "What's my most expensive order?"
- Metric: max
- Result: "Maximum: USD 1,299.99" + order details

Example 6: "What's my cheapest order last month?"
- Metric: min
- Time Range: last month
- Result: "Minimum: USD 15.99" + order details
*/

// ============================================
// CONFIGURATION-DRIVEN APPROACH
// ============================================

/*
The analytics system is completely config-driven:

1. NO INTENT-SPECIFIC CODE in executor
   - Single handleAnalyticsQuery() method
   - Works for ALL metric types

2. Metric detection is pattern-based
   - Add new metrics by updating detectMetric() patterns
   - No changes to executor needed

3. Aggregation is generic
   - executeAggregation() handles all operations
   - Switch statement for different metrics
   - Easy to add new aggregation types

4. Filtering is dynamic
   - Filters applied based on request object
   - Works with any combination of filters

5. Time range extraction is extensible
   - Pattern-based matching
   - Easy to add new time range formats

BENEFITS:
✅ Single code path for all analytics
✅ Easy to add new metrics
✅ Easy to add new filters
✅ Easy to add new time ranges
✅ Testable and maintainable
✅ No duplication
*/
