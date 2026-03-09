/**
 * Prompt Templates for LLM-powered Shop Pilot
 *
 * All system prompts and prompt-builder helpers live here so they can be
 * versioned, tested, and tuned independently of the service/processor code.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. INPUT PROCESSING — Intent Detection & Entity Extraction
// ─────────────────────────────────────────────────────────────────────────────

export const INPUT_SYSTEM_PROMPT = `You are an e-commerce intent classifier and entity extractor for an online shopping assistant.

## Your Task
Given a user message, output **only** a JSON object (no markdown, no explanation) with the detected intent(s) and extracted entities.

## Supported Intents
| Intent             | Description                                    | Required Entities               |
|--------------------|------------------------------------------------|---------------------------------|
| product_search     | Search / browse products (NO numbers/SKUs)    | query                           |
| add_to_cart        | Add a product to shopping cart                 | sku (if known), product, quantity |
| add_to_wishlist    | Save a product to wishlist                     | sku (if known), product         |
| check_price        | Ask about a product's price                    | product                         |
| select_product     | View product details (requires number/SKU)     | sku                             |
| compare_products   | Compare two products side by side              | sku1, sku2                      |
| view_orders        | View order history / list orders               | (none)                          |
| track_order        | Track a specific order                         | order_number                    |
| view_cart          | View current cart contents                     | (none)                          |
| place_order        | Checkout / place an order                      | (none)                          |
| cancel_order       | Cancel an order                                | order_number, reason            |
| return_order       | Request a return                               | order_number, reason            |
| analytics_query    | Ask about spending, order stats                | (product, time_range optional)  |
| reset_cart         | Clear / empty / reset shopping cart            | (none)                          |

## Entity Reference
- **product**: product name/type (shoes, laptop, jacket, etc.)
- **sku**: product SKU code like "WSH12" (uppercase letters + digits)
- **quantity**: integer, default 1
- **order_number**: order ID (numeric or alphanumeric)
- **reason**: free-text reason for cancellation/return
- **query**: search query string built from product + attributes
- **attributes**: object with optional keys: color, size, material

### ⚠️ CRITICAL: product_search vs select_product Decision Rules

**Use select_product when ANY of these conditions are met:**
1. Query contains a SKU code (uppercase letters + digits): "WSH12", "ADB392"
2. Query contains ANY number (position reference): "1", "2", "3", "23", etc.
3. Query has number + any verb/noun: "show 1", "details 2", "info 5"
4. Query has SKU-like pattern: "ADB386", "PROD123"

**Use product_search ONLY when:**
1. NO numbers or SKU codes present in query
2. Query contains only product type/attributes: "blue shoes", "laptops", "red jackets"
3. Query is purely descriptive search terms

**Examples:**
✅ "show 1" → select_product (has number)
✅ "show details 2" → select_product (has number)
✅ "show ADB386" → select_product (has SKU)
✅ "show details ADB386" → select_product (has SKU)
✅ "details of WSH12" → select_product (has SKU)
✅ "info about 5" → select_product (has number)
✅ "tell me about item 3" → select_product (has number)
❌ "show shoes" → product_search (NO number, NO SKU)
❌ "find blue jackets" → product_search (NO number, NO SKU)
❌ "search laptops" → product_search (NO number, NO SKU)

**CRITICAL RULE:** If you see ANY digit (0-9) anywhere in the query, assume it's a position reference and use select_product, NOT product_search.

**Context Requirement:** select_product requires that a product_search has already been performed in the conversation. This allows users to reference products by position (1, 2, 3...) from search results.

### Canonical Attribute Values
Colors: red, blue, black, white, green, yellow, pink, purple, gray, brown
Sizes: xs, s, m, l, xl, xxl
Materials: cotton, leather, denim, silk, polyester, wool

Map common misspellings/synonyms to canonical values (e.g. "blu"→"blue", "meduim"→"m", "navy"→"blue", "larg"→"l").

## Output Format
Return ONLY valid JSON. No markdown code fences. No extra text.
{
  "intents": [
    {
      "name": "<intent_name>",
      "confidence": <0.0-1.0>,
      "entities": {
        "product": "<string or null>",
        "sku": "<string or null>",
        "quantity": <number or null>,
        "order_number": "<string or null>",
        "reason": "<string or null>",
        "query": "<string or null>",
        "attributes": { "color": "<canonical or null>", "size": "<canonical or null>", "material": "<canonical or null>" }
      }
    }
  ]
}

## Rules
1. Detect up to 2 intents if the query clearly expresses multiple actions.
2. Assign confidence from 0.0 to 1.0 — 1.0 means absolutely certain.
3. Correct typos and informal language when extracting entities.
4. **CRITICAL:** If the query contains ANY number or SKU code for a SINGLE product, use select_product. If it contains TWO numbers/SKUs with comparison words (compare, versus, vs), use compare_products.
5. Never invent SKUs yourself — only extract them if the user explicitly provided one.
6. For analytics_query, set query to the full user text.
7. Position numbers (1, 2, 3...) should be treated as SKU references for select_product or compare_products intents depending on context.`;

// ─────────────────────────────────────────────────────────────────────────────
// 2. FEW-SHOT EXAMPLES for input processing
// ─────────────────────────────────────────────────────────────────────────────

export const INPUT_FEW_SHOT_EXAMPLES = [
  {
    role: 'user',
    content: 'show me blue running shoes',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'product_search',
          confidence: 0.95,
          entities: {
            product: 'running shoes',
            sku: null,
            quantity: null,
            order_number: null,
            reason: null,
            query: 'blue running shoes',
            attributes: { color: 'blue', size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'add WSH12 to my cart',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'add_to_cart',
          confidence: 0.98,
          entities: {
            product: null,
            sku: 'WSH12',
            quantity: 1,
            order_number: null,
            reason: null,
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: "I want to return order 000012345 because it's defective",
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'return_order',
          confidence: 0.96,
          entities: {
            product: null,
            sku: null,
            quantity: null,
            order_number: '000012345',
            reason: 'defective',
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'how much did i spend last month',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'analytics_query',
          confidence: 0.92,
          entities: {
            product: null,
            sku: null,
            quantity: null,
            order_number: null,
            reason: null,
            query: 'how much did i spend last month',
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'trck my ordr 45678',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'track_order',
          confidence: 0.93,
          entities: {
            product: null,
            sku: null,
            quantity: null,
            order_number: '45678',
            reason: null,
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'show me details of WSH12',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'select_product',
          confidence: 0.95,
          entities: {
            product: null,
            sku: 'WSH12',
            quantity: null,
            order_number: null,
            reason: null,
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'details for ADB392',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'select_product',
          confidence: 0.93,
          entities: {
            product: null,
            sku: 'ADB392',
            quantity: null,
            order_number: null,
            reason: null,
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'show me blue shoes',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'product_search',
          confidence: 0.94,
          entities: {
            product: 'shoes',
            sku: null,
            quantity: null,
            order_number: null,
            reason: null,
            query: 'blue shoes',
            attributes: { color: 'blue', size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'show 1',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'select_product',
          confidence: 0.95,
          entities: {
            product: null,
            sku: '1',
            quantity: null,
            order_number: null,
            reason: null,
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'show details 2',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'select_product',
          confidence: 0.96,
          entities: {
            product: null,
            sku: '2',
            quantity: null,
            order_number: null,
            reason: null,
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'show ADB386',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'select_product',
          confidence: 0.97,
          entities: {
            product: null,
            sku: 'ADB386',
            quantity: null,
            order_number: null,
            reason: null,
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'show shirts',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'product_search',
          confidence: 0.93,
          entities: {
            product: 'shirts',
            sku: null,
            quantity: null,
            order_number: null,
            reason: null,
            query: 'shirts',
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'info about 5',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'select_product',
          confidence: 0.94,
          entities: {
            product: null,
            sku: '5',
            quantity: null,
            order_number: null,
            reason: null,
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'compare 1 and 2',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'compare_products',
          confidence: 0.98,
          entities: {
            sku1: '1',
            sku2: '2',
            product: null,
            quantity: null,
            order_number: null,
            reason: null,
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'compare ADB386 with WSH12',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      intents: [
        {
          name: 'compare_products',
          confidence: 0.99,
          entities: {
            sku1: 'ADB386',
            sku2: 'WSH12',
            product: null,
            quantity: null,
            order_number: null,
            reason: null,
            query: null,
            attributes: { color: null, size: null, material: null },
          },
        },
      ],
    }),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. OUTPUT GENERATION — Natural Language Response
// ─────────────────────────────────────────────────────────────────────────────

export const RESPONSE_SYSTEM_PROMPT = `You are a friendly, concise e-commerce shopping assistant.

## Your Task
Given the intent, action result data, and recent conversation, write a **single** short, natural-sounding response message to the user.

## Guidelines
- Be concise: 1-3 sentences max.
- Sound conversational and warm, not robotic.
- Use emoji sparingly (max 1-2 per message).
- **Never hallucinate** product names, prices, order numbers, or any data — only reference what is provided in the action result.
- If the action failed, be empathetic and suggest what the user can try next.
- For add_to_cart / add_to_wishlist success, confirm the product name and action.
- For track_order, mention the status clearly.
- For analytics_query, present the number clearly with context.
- For select_product, create a rich product summary highlighting key features, price, and availability from the provided product data.
- Do NOT include any system/debug info, JSON, or code.
- Write plain text only (no markdown formatting).`;

// ─────────────────────────────────────────────────────────────────────────────
// 4. Prompt Builder Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the full messages array for input processing (intent detection).
 * @param {string} userText — raw user input
 * @param {Array} conversationHistory — recent exchanges [{input, intents, results}]
 * @returns {Array<{role: string, content: string}>}
 */
export function buildInputMessages(userText, conversationHistory = []) {
  const messages = [
    { role: 'system', content: INPUT_SYSTEM_PROMPT },
    // Few-shot examples
    ...INPUT_FEW_SHOT_EXAMPLES,
  ];

  // Add recent conversation context (last 3 turns) for reference resolution
  const recentHistory = conversationHistory.slice(-3);
  if (recentHistory.length > 0) {
    const contextSummary = recentHistory
      .map((h) => {
        const intentNames = (h.intents || []).map((i) => i.name).join(', ');
        return `User: "${h.input}" → Intents: [${intentNames}]`;
      })
      .join('\n');

    messages.push({
      role: 'system',
      content: `Recent conversation context:\n${contextSummary}`,
    });
  }

  // The current user message
  messages.push({ role: 'user', content: userText });

  return messages;
}

/**
 * Build the full messages array for response generation.
 * @param {string} intentName — the executed intent
 * @param {Object} actionResult — raw result from ActionExecutor
 * @param {Array} conversationHistory — recent exchanges
 * @returns {Array<{role: string, content: string}>}
 */
export function buildResponseMessages(
  intentName,
  actionResult,
  conversationHistory = [],
) {
  const messages = [{ role: 'system', content: RESPONSE_SYSTEM_PROMPT }];

  // Provide the action context
  const dataSnapshot = summarizeActionResult(intentName, actionResult);

  messages.push({
    role: 'user',
    content: `Intent: ${intentName}\nSuccess: ${actionResult.success}\nData: ${dataSnapshot}\n\nWrite a natural response message for the user.`,
  });

  return messages;
}

/**
 * Create a concise data summary for the LLM so it doesn't receive huge payloads.
 * @param {string} intent
 * @param {Object} result
 * @returns {string}
 */
function summarizeActionResult(intent, result) {
  if (!result) return 'No data available.';

  try {
    switch (intent) {
      case 'add_to_cart':
      case 'add_to_wishlist': {
        const product = result.data?.product?.name || result.data?.productName || 'unknown product';
        const qty = result.data?.quantity || 1;
        return `Product: ${product}, Quantity: ${qty}`;
      }
      case 'check_price': {
        const name = result.data?.product?.name || 'the product';
        const price = result.data?.price;
        const formatted =
          typeof price === 'object'
            ? `${price.currency || 'USD'} ${(price.value || price.amount || 0).toFixed(2)}`
            : price != null
              ? `$${Number(price).toFixed(2)}`
              : 'unavailable';
        return `Product: ${name}, Price: ${formatted}`;
      }
      case 'select_product': {
        // Pass full product data to LLM for rich summary generation
        if (result.data) {
          const productJSON = JSON.stringify({
            name: result.data.name,
            sku: result.data.sku,
            description: result.data.description,
            shortDescription: result.data.shortDescription,
            price: result.data.price,
            specialPrice: result.data.specialPrice,
            inStock: result.data.inStock,
            attributes: result.data.attributes,
            images: result.data.images?.length ? `${result.data.images.length} images` : 'no images'
          }, null, 2);
          return `Product Details:\n${productJSON}`;
        }
        return 'Product data unavailable';
      }
      case 'track_order': {
        const num =
          result.data?.order?.number || result.data?.orderNumber || 'unknown';
        const status =
          result.data?.order?.status || result.data?.status || 'unknown';
        return `Order: #${num}, Status: ${status}`;
      }
      case 'view_cart': {
        const count = result.data?.itemCount ?? result.data?.items?.length ?? 0;
        const total = result.data?.total;
        return `Items: ${count}, Total: ${total ? JSON.stringify(total) : 'N/A'}`;
      }
      case 'place_order': {
        const orderNum =
          result.data?.number || result.data?.id || 'unknown';
        return `Order number: ${orderNum}`;
      }
      case 'cancel_order':
      case 'return_order':
      case 'reset_cart': {
        return result.message || 'Action completed.';
      }
      case 'analytics_query': {
        const req = result.data?.request || {};
        const res = result.data?.result || {};
        return `Metric: ${req.metric || 'N/A'}, Value: ${res.value ?? 'N/A'}, Unit: ${res.unit || ''}, Time: ${req.dateRange?.label || 'all time'}`;
      }
      default:
        return result.message || JSON.stringify(result.data || {}).slice(0, 300);
    }
  } catch {
    return result.message || 'Data could not be summarized.';
  }
}
