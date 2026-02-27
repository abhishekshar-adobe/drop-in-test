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
| product_search     | Search / browse products                       | query                           |
| add_to_cart        | Add a product to shopping cart                 | sku (if known), product, quantity |
| add_to_wishlist    | Save a product to wishlist                     | sku (if known), product         |
| check_price        | Ask about a product's price                    | product                         |
| view_orders        | View order history / list orders               | (none)                          |
| track_order        | Track a specific order                         | order_number                    |
| view_cart          | View current cart contents                     | (none)                          |
| place_order        | Checkout / place an order                      | (none)                          |
| cancel_order       | Cancel an order                                | order_number, reason            |
| return_order       | Request a return                               | order_number, reason            |
| analytics_query    | Ask about spending, order stats                | (product, time_range optional)  |

## Entity Reference
- **product**: product name/type (shoes, laptop, jacket, etc.)
- **sku**: product SKU code like "WSH12" (uppercase letters + digits)
- **quantity**: integer, default 1
- **order_number**: order ID (numeric or alphanumeric)
- **reason**: free-text reason for cancellation/return
- **query**: search query string built from product + attributes
- **attributes**: object with optional keys: color, size, material

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
4. If the user references "the 2nd one" or "number 3", treat that as a product position reference and set quantity to that number.
5. Never invent SKUs yourself — only extract them if the user explicitly provided one.
6. For analytics_query, set query to the full user text.`;

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
      case 'return_order': {
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
