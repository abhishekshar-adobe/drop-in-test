# Shop Pilot — Architecture Document

> **Last updated:** February 2026  
> A comprehensive guide to how Shop Pilot works internally — from user input to final response.

---

## 1. High-Level Overview

Shop Pilot is an AI-powered e-commerce chatbot that converts natural language into structured e-commerce actions (product search, cart management, order operations, analytics). It uses a **dual-pipeline architecture**: a **local LLM path** (Ollama / Llama 3.1) for superior NLU, with an automatic **rule-based fallback** when the LLM is unavailable.

### System-Level Flow

```
┌──────────────┐
│  User Input   │  "show me blue shoes and add 1 to cart"
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│                   ShopPilot.process()                 │
│                   (Main Orchestrator)                 │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  PATH A: LLM-First (Ollama / Llama 3.1)        │ │
│  │  LLMInputProcessor → Structured JSON Intents    │ │
│  └─────────────┬───────────────────────────────────┘ │
│                │ success? ─── yes ──→ scoredIntents   │
│                │                                      │
│                no (fallback)                          │
│                │                                      │
│  ┌─────────────▼───────────────────────────────────┐ │
│  │  PATH B: Rule-Based Pipeline                    │ │
│  │  Tokenizer → DLM → IntentDetector → Confidence  │ │
│  └─────────────┬───────────────────────────────────┘ │
│                │                                      │
│                ▼                                      │
│        [ Scored Intents ]                             │
│                │                                      │
│                ▼                                      │
│        Clarification Check (confidence < 0.4?)        │
│                │                                      │
│                ▼                                      │
│        Slot Validation (required entities present?)    │
│                │                                      │
│                ▼                                      │
│        ActionExecutor → E-commerce API (GraphQL)      │
│                │                                      │
│                ▼                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Response Layer                                 │ │
│  │  LLMResponseGenerator → Template Fallback       │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│   Response    │  { message, data, displayAs, intent }
└──────────────┘
```

---

## 2. Architecture Layers

The system is organized into **6 layers**, each with a single responsibility:

| Layer | Module(s) | Responsibility |
|-------|-----------|----------------|
| **1. Input Processing** | `tokenizer.js` | Text normalization, stop-word removal, Levenshtein similarity |
| **2. Domain Language Model** | `dlm.js` | Entity extraction, pattern matching, attribute normalization |
| **3. Intent Detection** | `intentDetector.js` | Multi-intent detection, scoring, priority resolution |
| **4. Confidence & Clarification** | `confidence.js`, `clarification.js` | Confidence scoring, slot validation, clarification prompts |
| **5. Action Execution** | `executor.js`, `ecommerceApi.js` | Intent-to-action mapping, Adobe Commerce GraphQL API calls |
| **6. Response Generation** | `responseFormatter.js`, `llmResponseGenerator.js` | Natural language output (template-based or LLM-generated) |

**Cross-cutting:** `llmService.js`, `llmInputProcessor.js`, `prompts.js` — the LLM integration that can replace layers 1–4 and enhance layer 6.

---

## 3. Detailed Component Walkthrough

### 3.1 Main Orchestrator — `ShopPilot` (`src/index.js`)

The central class that wires everything together. Instantiates all subsystems and manages a **conversation context** for multi-turn interactions.

```
ShopPilot
├── dlm: DLM                        # Domain Language Model
├── intentDetector: IntentDetector    # Multi-intent detection
├── confidenceScorer: ConfidenceScorer
├── clarification: Clarification
├── executor: ActionExecutor          # E-commerce action execution
├── llmService: LLMService            # Ollama client
├── llmInput: LLMInputProcessor       # LLM-based intent detection
├── llmResponse: LLMResponseGenerator # LLM-based response writing
└── conversationContext: {
      history: [],          # Past {input, intents, results} tuples
      currentIntent: null,
      awaitingClarification: false,
      pendingAction: null,  # Stored when slot validation triggers search-first
      lastProducts: [],
      lastSearchResults: null
    }
```

**Key method — `process(userInput)`:**

1. **Try LLM path** → `llmInput.processInput(userInput, history)`
2. **On failure, run rule-based pipeline** → DLM → IntentDetector → ConfidenceScorer
3. **Check clarification** → if top intent confidence < 0.4, ask for clarification
4. **Validate slots** → ensure required entities exist; trigger sub-flows if missing
5. **Execute** → `executor.execute(scoredIntents)`
6. **Enhance response** → `llmResponse.generateOrFallback()` for text results
7. **Return** → formatted response with `{ success, message, data, displayAs, intent }`

---

### 3.2 LLM Integration Layer

#### 3.2.1 LLM Service (`src/llm/llmService.js`)

Low-level client wrapping the **Ollama REST API** (`http://localhost:11434`).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `isAvailable()` | `GET /api/tags` | Health check + model verification |
| `generate(prompt)` | `POST /api/generate` | Single-prompt completion |
| `chat(messages)` | `POST /api/chat` | Multi-turn chat completion |

**Resilience features:**
- Cached health checks (30s interval)
- Configurable retries (`maxRetries: 1`)
- AbortController-based timeouts (3s health, 8s input, 6s output)
- Automatic `_available = false` on repeated failures

#### 3.2.2 LLM Input Processor (`src/llm/llmInputProcessor.js`)

Replaces the entire rule-based NLP pipeline (Steps 1–3) when the LLM is available.

```
User Text
    │
    ▼
buildInputMessages()          ← System prompt + few-shot examples + context
    │
    ▼
LLMService.chat()            ← Ollama Llama 3.1, temp=0.3
    │
    ▼
_parseResponse()             ← Strip markdown fences, validate JSON
    │
    ▼
_mapToIntents()              ← Normalize entities, set confidence levels,
    │                           assign priorities, tag source='llm'
    ▼
Scored Intents Array          ← Compatible with ConfidenceScorer output format
```

**Prompt engineering (`src/llm/prompts.js`):**
- `INPUT_SYSTEM_PROMPT`: Detailed schema of all 11 intents, entity types, canonical attribute values, output JSON format
- `INPUT_FEW_SHOT_EXAMPLES`: 5 user/assistant pairs covering search, cart, returns, analytics, typo handling
- `buildInputMessages()`: Assembles system prompt + few-shot + last 3 conversation turns + current user message

#### 3.2.3 LLM Response Generator (`src/llm/llmResponseGenerator.js`)

Enhances text responses with natural language (skips UI-display responses).

```
Action Result
    │
    ▼
buildResponseMessages()       ← System prompt + summarized action data
    │
    ▼
LLMService.chat()            ← temp=0.7 for natural variation
    │
    ▼
_sanitize()                  ← Reject JSON, trim >500 chars
    │
    ▼
Natural Response Text

Fallback chain: LLM → Template (responseFormatter) → Raw message
```

---

### 3.3 Rule-Based NLP Pipeline (Fallback Path)

When the LLM is unavailable, processing follows this chain:

#### Step 1: Tokenizer (`src/utils/tokenizer.js`)

```
"Show me blue running shoes" 
    → lowercase 
    → remove special chars 
    → split on whitespace 
    → remove stop words 
    → ["show", "blue", "running", "shoes"]
```

Utilities: `normalize()`, `isStopWord()`, `similarity()` (Levenshtein), `extractEntities()` (regex patterns).

#### Step 2: Domain Language Model (`src/nlp/dlm.js`)

Loads vocabulary and patterns from `config/intents.json` at startup. Processes tokens into a **semantic object**:

```javascript
{
  originalText: "show me blue running shoes",
  tokens: ["show", "blue", "running", "shoes"],
  entities: { products: ["shoes"], actions: [] },
  patterns: { searchPattern: "blue running shoes" },
  verbs: ["show"],
  nouns: ["shoes"],
  numbers: [],
  orderId: null,
  attributes: { color: "blue", size: null, material: null }
}
```

**Key capabilities:**
- **Vocabulary matching**: Products, actions, attributes, modifiers (config-driven)
- **Pattern matching**: Search, add-to-cart, price, quantity regex patterns
- **Entity extraction**: Products, quantities (avoid SKU digits), reasons
- **Order ID extraction**: Numeric (`000005915`) and base64 (`NTkwNg==`) formats
- **Attribute normalization**: Canonical mappings (e.g., "crimson" → "red", "navy" → "blue", "extra small" → "xs")
- **Dual environment support**: Node.js (`fs`) and browser (`fetch`) for config loading

#### Step 3: Intent Detection (`src/nlp/intentDetector.js`)

Matches DLM output against intent definitions from `config/intents.json`.

**Scoring algorithm:**
1. For each intent, check all patterns against tokens/verbs/nouns/originalText
2. Calculate `matchRatio = matched words / total pattern words`
3. Multi-word patterns require ≥70% match; single-word ≥50%
4. Boost score +0.3 if relevant entities are present
5. Filter by intent-specific `confidenceThreshold`
6. Sort by priority, then score

**Multi-intent resolution:**
- Always include the top intent
- Include a second intent if its score ≥ 60% of the top intent's score
- **Exclusion rules**: Specific intents (`view_cart`, `add_to_cart`, etc.) suppress generic `product_search`

**Entity extraction per intent:**
Each intent extracts different entity sets — e.g., `product_search` builds a query string from attributes + nouns, `cancel_order` extracts `order_number` + `reason`.

#### Step 4: Confidence Scoring (`src/nlp/confidence.js`)

Refines raw scores with multipliers:

| Factor | Effect |
|--------|--------|
| Required slots missing | ×0.7 penalty |
| Entity quality (empty required entities) | ×0.8 per empty entity |
| Normalize | Clamp to 0–1 |

**Confidence levels:**
- **High** (≥ 0.7): Execute immediately
- **Medium** (0.4–0.7): May need clarification
- **Low** (< 0.4): Triggers clarification system

#### Step 4.5: Clarification System (`src/nlp/clarification.js`)

Generates user-friendly clarification prompts:

| Scenario | Behavior |
|----------|----------|
| No intents detected | "I'm not sure what you're looking for. Could you rephrase?" |
| Two intents with similar confidence (<0.2 diff) | "Did you want to: [option A] / [option B]?" |
| Missing required slot | Slot-specific question (e.g., "What's your order number?") |

---

### 3.4 Slot Validation & Auto-Completion (`ShopPilot.validateSlots`)

Runs **after** confidence scoring but **before** execution. Handles missing required entities with smart sub-flows:

```
┌─────────────────────────────────────────────────────────────┐
│  add_to_cart but no SKU?                                    │
│  → Search for products first → Show results                │
│  → If user said "add 2nd cap" → Auto-select product #2     │
│  → Execute add_to_cart with selected SKU                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  track_order but no order_number?                           │
│  → Show order list first → Ask user to pick one            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  cancel_order / return_order but no order_number?           │
│  → Show order list → Ask user to select                    │
│  No reason? → Ask for reason                               │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.5 Action Execution (`src/actions/executor.js`)

Maps intents to handler functions. Only executes intents with `confidenceLevel === 'high'`.

| Intent | Handler | API Method | Display Mode |
|--------|---------|------------|--------------|
| `product_search` | `handleProductSearch` | `searchProducts()` | **UI** (Product Grid) |
| `add_to_cart` | `handleAddToCart` | `addToCart()` via storefront-cart dropin | Text |
| `add_to_wishlist` | `handleAddToWishlist` | `addToWishlist()` via storefront-wishlist dropin | Text |
| `check_price` | `handleCheckPrice` | `getPrice()` | Text |
| `view_orders` | `handleViewOrders` | `getOrders()` | **UI** (Order List) |
| `track_order` | `handleTrackOrder` | `trackOrder()` | Text |
| `view_cart` | `handleViewCart` | `getCart()` | Text |
| `place_order` | `handlePlaceOrder` | `placeOrder()` | Text |
| `cancel_order` | `handleCancelOrder` | `cancelOrder()` | Text |
| `return_order` | `handleReturnOrder` | `returnOrder()` | Text |
| `analytics_query` | `handleAnalyticsQuery` | Analytics utils | Text/UI |

After execution, the **Natural Response Formatter** is applied to text results (skipped for `displayAs: 'ui'`).

---

### 3.6 E-commerce API (`src/actions/ecommerceApi.js`)

Interfaces with **Adobe Commerce (AEM Commerce)** via GraphQL.

**Configuration (`config/api-config.js`):**
```
Endpoint: https://www.aemshop.net/cs-graphql
Store:    main_website_store / default view / base website
Auth:     x-api-key header
```

**Key methods:**
- `graphqlRequest(query, variables)` — Generic GraphQL POST with cache-busting
- `searchProducts(query, attributes)` — Product search with dynamic filters (color, size, material)
- `addToCart(sku, qty, options)` — Uses storefront-cart dropin (`@aem/storefront-cart`)
- `addToWishlist(sku, qty, options)` — Uses storefront-wishlist dropin
- `getOrders()` / `trackOrder()` / `cancelOrder()` / `returnOrder()` — Order management
- `placeOrder(cartId)` — Checkout flow
- `getCart()` / `getCartId()` — Cart operations

**Resilience:** Falls back to mock data if the API is unreachable (for product search).

---

### 3.7 Analytics System (`src/utils/analytics.js`)

Config-driven analytics — **no intent-specific code required**. Add new metrics by updating patterns only.

```
User: "how much did I spend on shoes last year?"
            │
            ▼
    detectMetric(text)        → { metric: 'sum', field: 'total' }
            │
            ▼
    extractTimeRange(text)    → { start: 2025-01-01, end: 2025-12-31, label: 'last year' }
            │
            ▼
    buildAnalyticsRequest()   → { dataset: 'orders', metric: 'sum', filters: { product: 'shoes' },
            │                      dateRange: { ... }, originalQuery: '...' }
            ▼
    executeAggregation(req, data)  → Generic switch on metric: sum | count | avg | max | min | top | list
            │
            ▼
    formatAnalyticsResult()   → "📊 You spent $1,234.56 on shoes last year"
```

**Supported metrics:** `count`, `sum`, `avg`, `max`, `min`, `top`, `list`  
**Time ranges:** last year, this year, last month, this month, last N days, last week

---

### 3.8 Response Layer

#### Template-Based NLG (`src/utils/responseFormatter.js`)

Pre-defined templates with randomized variations for natural feel:

```javascript
add_to_cart.success: [
  "✅ Added {product} to your cart!",
  "✅ Got it! {product} is now in your cart.",
  "✅ Done! Your cart now has {product}.",
  "✅ Perfect! I've added {product} to your cart."
]
```

**Rules:**
- Only applied when `displayAs !== 'ui'` (preserves UI rendering for product/order lists)
- Placeholders (`{product}`, `{amount}`, `{order_number}`, etc.) replaced with actual data
- Different template sets for success/error/empty/not_found states

#### LLM-Enhanced NLG (`src/llm/llmResponseGenerator.js`)

When available, the LLM generates more natural responses:
1. `summarizeActionResult()` creates a concise data snapshot (avoids sending huge payloads to LLM)
2. `RESPONSE_SYSTEM_PROMPT` instructs the LLM to be concise (1–3 sentences), warm, no hallucination
3. Sanitization rejects JSON responses, trims to 500 chars

**Fallback chain:** LLM response → Template response → Raw executor message

---

### 3.9 UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `ProductListUI` | `src/components/ProductListUI.js` | Product grid with numbered cards, images, prices, click-to-select |
| `ProductCard` | `src/components/ProductCard.js` | Individual product card |
| `ProductList` | `src/components/ProductList.js` | Product list container |
| `OrderListUI` | `src/components/OrderListUI.js` | Order history list renderer |

Products with `inStock: false` are marked as unavailable. Card click triggers `onSelect(product, number)` callback.

---

## 4. Configuration

### 4.1 App Config (`config/config.js`)

| Setting | Value | Purpose |
|---------|-------|---------|
| `thresholds.highConfidence` | 0.7 | Execute intent immediately |
| `thresholds.lowConfidence` | 0.4 | Below this → clarification needed |
| `nlp.fuzzyThreshold` | 0.3 | Levenshtein matching threshold |
| `nlp.maxIntentsPerQuery` | 3 | Max simultaneous intents |
| `logging.level` | `'info'` | Log verbosity |

### 4.2 LLM Config (`config/llm-config.js`)

| Setting | Value | Purpose |
|---------|-------|---------|
| `enabled` | `true` | Toggle LLM on/off globally |
| `endpoint` | `http://localhost:11434` | Ollama server URL |
| `model` | `llama3.1` | Model identifier |
| `input.temperature` | 0.3 | Deterministic for intent classification |
| `output.temperature` | 0.7 | Natural variation for responses |
| `input.timeout` | 8000ms | Intent detection timeout |
| `output.timeout` | 6000ms | Response generation timeout |
| `fallbackOnError` | `true` | Auto-switch to rule-based pipeline |
| `healthCheckInterval` | 30000ms | How often to re-check Ollama |

### 4.3 Intent Definitions (`config/intents.json`)

Each intent defines:
```json
{
  "name": "add_to_cart",
  "patterns": ["add to cart", "add", "put in cart", "buy"],
  "entities": ["product", "quantity", "sku"],
  "requiredSlots": ["sku"],
  "priority": 0.9,
  "confidenceThreshold": 0.75
}
```

**11 intents supported:** `product_search`, `add_to_cart`, `add_to_wishlist`, `check_price`, `view_orders`, `track_order`, `view_cart`, `place_order`, `cancel_order`, `return_order`, `analytics_query`

---

## 5. Data Flow Examples

### Example 1: Simple Product Search

```
User: "show me red shoes"

1. LLM Path (if available):
   → LLMInputProcessor builds prompt with system + few-shot + user text
   → Ollama returns: { intents: [{ name: "product_search", confidence: 0.95,
                         entities: { query: "red shoes", attributes: { color: "red" } } }] }

   OR Rule-Based Fallback:
   → Tokenizer: ["show", "red", "shoes"]
   → DLM: entities={products:["shoes"]}, attributes={color:"red"}, verbs=["show"]
   → IntentDetector: product_search, rawScore=2.3
   → ConfidenceScorer: confidence=1.0, level="high"

2. Slot validation: query="red shoes" ✓
3. Executor: api.searchProducts("red shoes", {color:"red"})
4. Response: { displayAs: "ui", data: {items: [...], total: 5} }
   → ProductListUI renders grid (no NLG applied for UI responses)
```

### Example 2: Multi-Intent with Auto-Completion

```
User: "show cap and add 1 to cart"

1. IntentDetector detects TWO intents:
   - product_search (query: "cap")
   - add_to_cart (quantity: 1, no SKU)

2. processingSteps = [
     { step: 1, action: "Search for products", intent: "product_search" },
     { step: 2, action: "Add to cart", intent: "add_to_cart" }
   ]

3. Slot validation: add_to_cart missing SKU → triggers product_search first
4. Search executes → returns 5 cap products
5. User said "1" → auto-selects product #1
6. add_to_cart executes with selected SKU
7. Response: search results + "✅ Added Cap to your cart!"
```

### Example 3: Analytics Query

```
User: "how much did I spend on shoes last year?"

1. Intent: analytics_query
2. detectMetric: { metric: "sum", field: "total" }
3. extractTimeRange: { start: 2025-01-01, end: 2025-12-31, label: "last year" }
4. buildAnalyticsRequest: { dataset: "orders", metric: "sum",
                             filters: { product: "shoes" },
                             dateRange: { start: ..., end: ... } }
5. executeAggregation: filters orders → sums totals
6. formatAnalyticsResult: "📊 You spent $1,234.56 on shoes last year"
```

---

## 6. Project Structure

```
shop-pilot/
├── config/
│   ├── config.js              # App configuration (thresholds, NLP, logging)
│   ├── llm-config.js          # Ollama/Llama 3.1 configuration
│   ├── api-config.js          # Adobe Commerce GraphQL endpoint & queries
│   └── intents.json           # Intent definitions, vocabulary, patterns
│
├── src/
│   ├── index.js               # ShopPilot orchestrator (main entry point)
│   │
│   ├── nlp/                   # Rule-based NLP pipeline
│   │   ├── dlm.js            # Domain Language Model (entity extraction)
│   │   ├── intentDetector.js  # Multi-intent detection & scoring
│   │   ├── confidence.js      # Confidence scoring (slot-aware)
│   │   └── clarification.js   # Clarification prompt generator
│   │
│   ├── llm/                   # LLM integration (Ollama / Llama 3.1)
│   │   ├── llmService.js     # Ollama REST API client (health, generate, chat)
│   │   ├── llmInputProcessor.js # LLM-based intent detection & entity extraction
│   │   ├── llmResponseGenerator.js # LLM-based natural response writing
│   │   └── prompts.js        # System prompts, few-shot examples, builders
│   │
│   ├── actions/               # Action execution layer
│   │   ├── executor.js       # Intent → handler mapping & execution
│   │   └── ecommerceApi.js   # Adobe Commerce GraphQL API wrapper
│   │
│   ├── utils/                 # Shared utilities
│   │   ├── tokenizer.js      # Text normalization, stop words, Levenshtein
│   │   ├── analytics.js      # Config-driven analytics (metrics, aggregation)
│   │   ├── responseFormatter.js # Template-based NLG with variations
│   │   ├── helpers.js        # General helper functions
│   │   └── logger.js         # Configurable logging
│   │
│   ├── components/            # UI renderers
│   │   ├── ProductListUI.js  # Product grid component
│   │   ├── ProductCard.js    # Single product card
│   │   ├── ProductList.js    # Product list wrapper
│   │   └── OrderListUI.js   # Order list component
│   │
│   └── data/                  # Static data
│       ├── entities.json     # Entity definitions
│       └── sampleQueries.json # Sample test queries
│
├── tests/                     # Test suite (Vitest)
├── examples/                  # Usage examples
│   └── analytics-example.js  # End-to-end analytics demo
│
├── vitest.config.js           # Test configuration
├── package.json
└── README.md
```

---

## 7. Key Design Decisions

### Dual Pipeline (LLM + Rule-Based)
The LLM path provides superior natural language understanding (typo correction, complex multi-intent, context awareness) while the rule-based pipeline ensures the system **always works** — even without a GPU or Ollama installed. The switch is automatic and transparent.

### Config-Driven Intents
All intent patterns, required slots, priorities, and thresholds are defined in `intents.json`. Adding a new intent requires:
1. Add entry to `intents.json`
2. Add handler in `executor.js`
3. Add prompt coverage in `prompts.js` (for LLM path)

### Config-Driven Analytics
The analytics system uses a generic aggregation function controlled by detected metric patterns. No intent-specific code — adding new metrics means updating pattern arrays only.

### Response Fallback Chain
Three layers of response generation ensure users always get a meaningful reply:
1. **LLM**: Natural, contextual, conversational
2. **Templates**: Randomized pre-written variations
3. **Raw**: Direct executor message

### Slot Validation with Smart Sub-Flows
Rather than simply rejecting queries with missing entities, the system proactively searches for products or shows order lists, then uses position-based auto-selection ("add 2nd one to cart") to minimize friction.

---

## 8. Environment Support

| Environment | Config Loading | API Calls |
|-------------|---------------|-----------|
| **Node.js** | `fs/promises` + `path` | `fetch` (Node 18+) |
| **Browser** | `fetch('/shop-pilot/config/...')` | `fetch` (native) |

Both DLM and IntentDetector detect the environment at runtime and load configuration accordingly.

---

## 9. Prerequisites

### For Rule-Based Pipeline (always available)
- Node.js 18+ or modern browser
- Network access to Adobe Commerce GraphQL endpoint

### For LLM-Enhanced Pipeline (optional)
1. Install [Ollama](https://ollama.com/download)
2. Pull the model: `ollama pull llama3.1`
3. Start the server: `ollama serve`
4. For browser CORS: `export OLLAMA_ORIGINS="*" && ollama serve`
