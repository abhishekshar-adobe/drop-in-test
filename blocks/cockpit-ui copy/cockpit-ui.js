/**
 * Cockpit UI Block
 * AI-powered admin interface for managing orders, returns, and payments
 */

export default async function decorate(block) {
  // Create the main cockpit container
  const cockpitContainer = document.createElement("div");
  cockpitContainer.classList.add("cockpit-container");

  // Create header
  const header = document.createElement("div");
  header.classList.add("cockpit-header");
  header.innerHTML = `
    <h1>Cockpit AI Assistant</h1>
    <p>Manage your orders, returns, and payments with AI</p>
  `;

  // Create chat interface
  const chatInterface = document.createElement("div");
  chatInterface.classList.add("cockpit-chat");
  chatInterface.innerHTML = `
    <div class="chat-messages" id="chat-messages">
      <div class="message assistant">
        <div class="message-content">
          <p>👋 Hello! I'm your AI assistant. I can help you with:</p>
          <ul>
            <li>� Searching for products</li>
            <li>�📦 Managing orders</li>
            <li>↩️ Processing returns</li>
            <li>💳 Handling payments</li>
            <li>🛒 Adding items to cart</li>
            <li>❤️ Adding items to wishlist</li>
          </ul>
          <p>What would you like to do today?</p>
        </div>
      </div>
    </div>
    <div class="chat-input-container">
      <input 
        type="text" 
        id="chat-input" 
        class="chat-input" 
        placeholder="Ask me anything... (e.g., 'Show me recent orders')"
      />
      <button id="chat-send" class="chat-send-btn">Send</button>
    </div>
  `;

  // Create action cards
  const actionCards = document.createElement("div");
  actionCards.classList.add("cockpit-actions");
  actionCards.innerHTML = `
    <div class="action-card" data-action="search">
      <div class="card-icon">🔍</div>
      <h3>Search</h3>
      <p>Search for products</p>
    </div>
    <div class="action-card" data-action="orders">
      <div class="card-icon">📦</div>
      <h3>Orders</h3>
      <p>View and manage customer orders</p>
    </div>
    <div class="action-card" data-action="returns">
      <div class="card-icon">↩️</div>
      <h3>Returns</h3>
      <p>Process return requests</p>
    </div>
    <div class="action-card" data-action="payments">
      <div class="card-icon">💳</div>
      <h3>Payments</h3>
      <p>Handle payment transactions</p>
    </div>
    <div class="action-card" data-action="wishlist">
      <div class="card-icon">❤️</div>
      <h3>Wishlist</h3>
      <p>Manage wishlist items</p>
    </div>
  `;

  // Assemble the cockpit
  cockpitContainer.appendChild(header);
  cockpitContainer.appendChild(chatInterface);
  cockpitContainer.appendChild(actionCards);

  // Clear and append to block
  block.textContent = "";
  block.appendChild(cockpitContainer);

  // Initialize event listeners
  initializeCockpit();
}

/**
 * Initialize cockpit functionality
 */
function initializeCockpit() {
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  const chatMessages = document.getElementById("chat-messages");
  const actionCards = document.querySelectorAll(".action-card");

  // Create a persistent agent instance
  const agent = new CockpitAgent();
  window.cockpitAgent = agent; // Store globally for access

  // Handle send button click
  if (chatSend) {
    chatSend.addEventListener("click", () =>
      handleSendMessage(chatInput, chatMessages, agent)
    );
  }

  // Handle enter key in input
  if (chatInput) {
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSendMessage(chatInput, chatMessages, agent);
      }
    });
  }

  // Handle action card clicks
  actionCards.forEach((card) => {
    card.addEventListener("click", () => {
      const { action } = card.dataset;
      handleActionCard(action, chatMessages, agent);
    });
  });
}

/**
 * LangGraph-inspired Agent State Machine
 * Simplified version that works in browser without external dependencies
 */
class CockpitAgent {
  constructor() {
    this.state = {
      messages: [],
      intent: null,
      action: null,
      result: null,
    };
    this.lastSearchResults = null;
    this.pendingProduct = null; // Store product awaiting option selection
  }

  async process(userMessage) {
    // Step 1: Analyze Intent
    this.state.messages.push(userMessage);
    this.state.intent = this.analyzeIntent(userMessage);

    // Step 2: Execute Action
    this.state.result = await this.executeAction(this.state.intent);

    // Step 3: Format Response
    const response = this.formatResponse(this.state.intent, this.state.result);
    this.state.messages.push(response);

    return response;
  }

  analyzeIntent(message) {
    const text = message.toLowerCase();

    // Check if user is providing option selections (e.g., "1,2" or "1, 2")
    if (this.pendingProduct) {
      const optionMatch = text.match(/^[\d,\s]+$/);
      if (optionMatch) {
        const selections = text.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (selections.length > 0) {
          return { type: "select_product_options", entities: { selections } };
        }
      }
    }

    // Check if user is selecting a product by number
    if (this.lastSearchResults) {
      const numMatch = text.match(/^(\d+)$/);
      if (numMatch) {
        const index = parseInt(numMatch[1], 10) - 1;
        if (index >= 0 && index < this.lastSearchResults.length) {
          return { type: "select_product_by_number", entities: { index } };
        }
      }
    }

    if (
      text.includes("search") ||
      text.includes("find") ||
      text.includes("look for")
    ) {
      return { type: "product_search", entities: this.extractSearchQuery(message) };
    }
    if (
      text.includes("add to wishlist") ||
      text.includes("wishlist") ||
      text.includes("save for later")
    ) {
      return { type: "add_to_wishlist", entities: this.extractCartEntities(message) };
    }
    if (
      text.includes("add to cart") ||
      text.includes("add product") ||
      text.includes("add item")
    ) {
      return { type: "add_to_cart", entities: this.extractCartEntities(message) };
    }
    if (text.includes("order") || text.includes("purchase")) {
      return { type: "orders", entities: {} };
    }
    if (text.includes("return")) {
      return { type: "returns", entities: {} };
    }
    if (text.includes("payment")) {
      return { type: "payments", entities: {} };
    }

    return { type: "general", entities: {} };
  }

  extractCartEntities(text) {
    // Simple extraction - in production, use NLP
    const skuMatch = text.match(/sku[:\s]+([A-Z0-9-]+)/i);
    const quantityMatch = text.match(/(\d+)\s*(item|product|unit)/i);

    return {
      sku: skuMatch ? skuMatch[1].toUpperCase() : "MH01", // Default test SKU, always uppercase
      quantity: quantityMatch ? parseInt(quantityMatch[1], 10) : 1,
    };
  }

  extractSearchQuery(text) {
    // Extract search query from message
    const searchPatterns = [
      /search\s+(?:for\s+)?["']?([^"']+)["']?/i,
      /find\s+(?:me\s+)?["']?([^"']+)["']?/i,
      /look\s+for\s+["']?([^"']+)["']?/i,
    ];

    for (const pattern of searchPatterns) {
      const match = text.match(pattern);
      if (match) {
        return { query: match[1].trim() };
      }
    }

    // If no pattern matches, return empty query
    return { query: "" };
  }

  async executeAction(intent) {
    try {
      switch (intent.type) {
        case "product_search":
          return await this.handleProductSearch(intent.entities);

        case "select_product_by_number":
          return await this.handleSelectProductByNumber(intent.entities);

        case "select_product_options":
          return await this.handleSelectProductOptions(intent.entities);

        case "add_to_cart":
          return await this.handleAddToCart(intent.entities);

        case "add_to_wishlist":
          return await this.handleAddToWishlist(intent.entities);

        case "orders":
          return await this.handleOrders();

        case "returns":
          return await this.handleReturns();

        case "payments":
          return await this.handlePayments();

        default:
          return {
            success: true,
            message:
              "I can help with searching products, orders, returns, payments, adding products to cart, and managing your wishlist.",
          };
      }
    } catch (error) {
      console.error("Action execution error:", error);
      return { success: false, error: error.message };
    }
  }

  async handleProductSearch(entities) {
    try {
      const { query } = entities;

      if (!query) {
        return {
          success: false,
          message: "Please provide a search query. Example: 'search for shirts'",
        };
      }

      console.log("Searching for:", query);

      // Import required utilities and API
      const { getHeaders } = await import("@dropins/tools/lib/aem/configs.js");
      const { commerceEndpointWithQueryParams } = await import("../../scripts/commerce.js");
      const productDiscoveryApi = await import("@dropins/storefront-product-discovery/api.js");

      // Initialize the API with proper headers and endpoint
      try {
        const endpoint = await commerceEndpointWithQueryParams();
        productDiscoveryApi.setEndpoint(endpoint);
        productDiscoveryApi.setFetchGraphQlHeaders((prev) => ({ ...prev, ...getHeaders('cs') }));
        console.log("Product discovery API initialized with endpoint:", endpoint);
      } catch (initError) {
        console.warn("API initialization warning:", initError);
      }

      // Perform product search with proper parameters
      const searchParams = {
        phrase: query,
        pageSize: 5,
        currentPage: 1,
      };

      console.log("Search params:", searchParams);

      const result = await productDiscoveryApi.productSearch(searchParams);

      console.log("Search result:", result);
      console.log("Result structure:", JSON.stringify(result, null, 2));

      // Handle the response - the API returns { productSearch: { ... } }
      const searchData = result?.productSearch || result;
      const items = searchData?.items || [];
      const totalCount = searchData?.total_count || 0;

      console.log("Extracted items:", items.length, "Total count:", totalCount);

      if (items && items.length > 0) {
        // Store search results for numeric selection
        this.lastSearchResults = items.slice(0, 5).map(item => item.productView);

        // Create HTML product cards with numbers
        const productCards = this.lastSearchResults.map((product, index) => {
          const number = index + 1;
          
          // Get first image
          const imageUrl = product.images?.[0]?.url || "";
          
          // Extract price based on product type
          let priceText = "";
          if (product.__typename === "ComplexProductView" && product.priceRange) {
            const minPrice = product.priceRange.minimum.final.amount.value;
            const maxPrice = product.priceRange.maximum.final.amount.value;
            
            if (minPrice === maxPrice) {
              priceText = `$${minPrice.toFixed(2)}`;
            } else {
              priceText = `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
            }
          } else if (product.price) {
            const price = product.price.final.amount.value;
            const regularPrice = product.price.regular.amount.value;
            
            if (price < regularPrice) {
              priceText = `<span class="sale-price">$${price.toFixed(2)}</span> <del>$${regularPrice.toFixed(2)}</del>`;
            } else {
              priceText = `$${price.toFixed(2)}`;
            }
          }
          
          return `
            <div class="product-card" data-sku="${product.sku}">
              <div class="product-number">${number}</div>
              <div class="product-image">
                ${imageUrl ? `<img src="${imageUrl}" alt="${product.name}" />` : '<div class="no-image">No Image</div>'}
              </div>
              <div class="product-info">
                <h4 class="product-name">${product.name}</h4>
                <p class="product-sku">SKU: ${product.sku}</p>
                <p class="product-price">${priceText}</p>
              </div>
            </div>
          `;
        }).join("");

        return {
          success: true,
          message: `<div class="search-header">🔍 Found ${totalCount} products matching "${query}"</div><div class="product-grid">${productCards}</div><div class="selection-prompt">💬 Enter a number (1-5) to add that product to your cart</div>`,
          isHtml: true,
        };
      }

      return {
        success: true,
        message: `🔍 No products found for "${query}". Try a different search term.`,
      };
    } catch (error) {
      console.error("Product search error details:", error);
      console.error("Error stack:", error.stack);
      
      // More detailed error message
      let errorMsg = error.message || "Unknown error";
      if (error.message?.includes("500")) {
        errorMsg = "Server error (500). Please check console for details.";
      }
      
      return {
        success: false,
        message: `❌ Search failed: ${errorMsg}`,
      };
    }
  }

  async handleSelectProductByNumber(entities) {
    try {
      const { index } = entities;
      const product = this.lastSearchResults[index];

      if (!product) {
        return {
          success: false,
          message: "❌ Invalid product selection. Please try again.",
        };
      }

      // Import the cart dropin
      const cartApi = await import("@dropins/storefront-cart/api.js");

      // Add product to cart with just SKU and quantity
      const result = await cartApi.addProductsToCart([
        {
          sku: product.sku,
          quantity: 1,
        },
      ]);

      console.log("Add to cart result:", result);

      // Clear search results after adding
      this.lastSearchResults = null;

      return {
        success: true,
        message: `✅ Successfully added "${product.name}" (SKU: ${product.sku}) to cart!`,
        data: result,
      };
    } catch (error) {
      console.error("Add to cart by number error:", error);
      return {
        success: false,
        message: `❌ Failed to add to cart: ${error.message}`,
      };
    }
  }

  async handleSelectProductOptions(entities) {
    try {
      const { selections } = entities;
      const product = this.pendingProduct;

      if (!product) {
        return {
          success: false,
          message: "❌ No product pending option selection. Please search and select a product first.",
        };
      }

      // Build optionUIDs array from selections
      const optionUIDs = [];
      selections.forEach((selectionNum, optionIndex) => {
        const option = product.options[optionIndex];
        if (option && option.values) {
          const valueIndex = selectionNum - 1;
          const selectedValue = option.values[valueIndex];
          if (selectedValue && selectedValue.id) {
            optionUIDs.push(selectedValue.id);
          }
        }
      });

      if (optionUIDs.length === 0) {
        return {
          success: false,
          message: "❌ Invalid option selections. Please try again.",
        };
      }

      // Import the cart dropin
      const cartApi = await import("@dropins/storefront-cart/api.js");

      // Add configurable product with options
      const result = await cartApi.addProductsToCart([
        {
          sku: product.sku,
          quantity: 1,
          optionsUIDs: optionUIDs,
        },
      ]);

      // Clear pending product and search results
      this.pendingProduct = null;
      this.lastSearchResults = null;

      return {
        success: true,
        message: `✅ Successfully added \"${product.name}\" with your selected options to cart!`,
        data: result,
      };
    } catch (error) {
      console.error("Add configurable product error:", error);
      return {
        success: false,
        message: `❌ Failed to add to cart: ${error.message}`,
      };
    }
  }

  async handleAddToCart(entities) {
    try {
      const { sku, quantity } = entities;

      // Import the cart dropin
      const cartApi = await import("@dropins/storefront-cart/api.js");

      // Add products to cart using the dropin
      const result = await cartApi.addProductsToCart([
        {
          sku,
          quantity,
        },
      ]);

      return {
        success: true,
        message: `✅ Successfully added ${quantity} item(s) with SKU ${sku} to cart!`,
        data: result,
      };
    } catch (error) {
      console.error("Add to cart error:", error);
      return {
        success: false,
        message: `❌ Failed to add to cart: ${error.message}`,
      };
    }
  }

  async handleAddToWishlist(entities) {
    try {
      const { sku, quantity } = entities;

      // Import the wishlist dropin
      const wishlistApi = await import("@dropins/storefront-wishlist/api.js");

      // Add products to wishlist using the dropin
      const result = await wishlistApi.addProductsToWishlist([
        {
          sku,
          quantity,
        },
      ]);

      return {
        success: true,
        message: `❤️ Successfully added ${quantity} item(s) with SKU ${sku} to wishlist!`,
        data: result,
      };
    } catch (error) {
      console.error("Add to wishlist error:", error);
      return {
        success: false,
        message: `❌ Failed to add to wishlist: ${error.message}`,
      };
    }
  }

  async handleOrders() {
    // TODO: Connect to real orders API
    return {
      success: true,
      message:
        "📦 I found 3 recent orders. The latest order #12345 is being processed and should ship tomorrow.",
    };
  }

  async handleReturns() {
    // TODO: Connect to real returns API
    return {
      success: true,
      message:
        "↩️ There are 2 pending return requests. Order #12340 - Customer wants to return a shirt (size issue).",
    };
  }

  async handlePayments() {
    // TODO: Connect to real payments API
    return {
      success: true,
      message:
        "💳 Payment summary: 15 successful transactions today totaling $4,532.00. No failed payments.",
    };
  }

  formatResponse(intent, result) {
    if (result.success) {
      return result.message;
    }
    return `⚠️ ${result.message || "Something went wrong. Please try again."}`;
  }
}

/**
 * Handle sending a message
 */
async function handleSendMessage(inputElement, messagesContainer, agent) {
  const message = inputElement.value.trim();

  if (!message) return;

  // Add user message to chat
  addMessage("user", message, messagesContainer);
  // eslint-disable-next-line no-param-reassign
  inputElement.value = "";

  // Show typing indicator
  addTypingIndicator(messagesContainer);

  try {
    // Use the persistent Cockpit Agent
    const response = await agent.process(message);

    // Remove typing indicator
    removeTypingIndicator();

    // Display response
    addMessage("assistant", response, messagesContainer);
  } catch (error) {
    console.error("Agent error:", error);
    removeTypingIndicator();
    addMessage(
      "assistant",
      "⚠️ Sorry, I encountered an error. Please try again.",
      messagesContainer
    );
  }
}

/**
 * Handle action card clicks
 */
async function handleActionCard(action, messagesContainer, agent) {
  addTypingIndicator(messagesContainer);
  
  const actionMessages = {
    search: "search for products",
    orders: "show me orders",
    returns: "show me returns",
    payments: "show me payments",
    wishlist: "show me wishlist",
  };

  const response = await agent.process(actionMessages[action]);
  
  removeTypingIndicator();
  addMessage("assistant", response, messagesContainer);
}

/**
 * Add a message to the chat
 */
function addMessage(type, content, container) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", type);

  const messageContent = document.createElement("div");
  messageContent.classList.add("message-content");
  messageContent.innerHTML = `<p>${content}</p>`;

  messageDiv.appendChild(messageContent);
  container.appendChild(messageDiv);

  // Add click handlers for add to cart buttons
  const addToCartBtns = messageContent.querySelectorAll(".add-to-cart-btn");
  addToCartBtns.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const sku = btn.dataset.sku;
      const name = btn.dataset.name;
      
      // Disable button and show loading state
      btn.disabled = true;
      btn.textContent = "Adding...";
      
      try {
        const agent = new CockpitAgent();
        const response = await agent.process(`add to cart sku: ${sku}`);
        
        // Show success message
        addMessage("assistant", response, container);
      } catch (error) {
        addMessage("assistant", `❌ Failed to add ${name} to cart`, container);
      } finally {
        btn.disabled = false;
        btn.textContent = "🛒 Add to Cart";
      }
    });
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

/**
 * Add typing indicator
 */
function addTypingIndicator(container) {
  const indicator = document.createElement("div");
  indicator.classList.add("message", "assistant", "typing-indicator");
  indicator.id = "typing-indicator";
  indicator.innerHTML = `
    <div class="message-content">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) {
    indicator.remove();
  }
}
