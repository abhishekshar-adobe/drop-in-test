import ShopPilot from '../../shop-pilot/src/index.js';
import ProductListUI from '../../shop-pilot/src/components/ProductListUI.js';
import OrderListUI from '../../shop-pilot/src/components/OrderListUI.js';

export default async function decorate(block) {
  // Remove all existing children
  while (block.firstChild) {
    block.removeChild(block.firstChild);
  }
  
  // Initialize ShopPilot AI (with error handling)
  let shopPilot = null;
  try {
    shopPilot = new ShopPilot();
  } catch (error) {
    console.warn('ShopPilot AI not available, using fallback responses:', error);
  }
  
  // Create chatbot container structure
  const chatbotHTML = `
    <div class="chatbot-container">
      <div class="chatbot-window">
        <div class="chatbot-header">
          <div class="chatbot-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <div class="chatbot-info">
            <h3>AI Assistant</h3>
            <span class="chatbot-status">
              <span class="status-indicator"></span>
              Online
            </span>
            <span class="llm-status" title="LLM Status">
              <span class="llm-indicator"></span>
              <span class="llm-label">LLM</span>
            </span>
          </div>
        </div>
        
        <div class="chatbot-messages">
          <div class="message bot-message">
            <div class="message-avatar">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
              </svg>
            </div>
            <div class="message-content">
              <div class="message-bubble">
                <p>Hi! 👋 I'm your AI shopping assistant. How can I help you today?</p>
              </div>
              <span class="message-time">Just now</span>
            </div>
          </div>
        </div>
        
        <div class="quick-replies">
          <button class="quick-reply" data-message="Show me trending products">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            Trending
          </button>
          <button class="quick-reply" data-message="I need help with my order">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Help
          </button>
          <button class="quick-reply" data-message="Track my order">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            Track
          </button>
        </div>
        
        <div class="chatbot-input-area">
          <div class="input-container">
            <button class="attachment-btn" aria-label="Attach file">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>
            <input 
              type="text" 
              class="chatbot-input" 
              placeholder="Type your message..."
              aria-label="Chat message input"
            />
            <button class="voice-btn" aria-label="Voice input" title="Click to speak">
              <svg class="mic-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
              <svg class="mic-off-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>
            <button class="send-btn" aria-label="Send message">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <div class="typing-indicator" style="display: none;">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Create the chatbot DOM structure
  const wrapper = document.createElement('div');
  wrapper.innerHTML = chatbotHTML;
  
  // Append the chatbot to the block
  block.appendChild(wrapper.firstElementChild);

  // Check LLM availability and update indicator
  if (shopPilot) {
    shopPilot.isLLMAvailable().then((available) => {
      const indicator = block.querySelector('.llm-indicator');
      const label = block.querySelector('.llm-label');
      if (indicator) {
        indicator.classList.toggle('llm-active', available);
        indicator.classList.toggle('llm-inactive', !available);
      }
      if (label) {
        label.textContent = available ? 'LLM Active' : 'LLM Off';
      }
    }).catch(() => {
      // Silently ignore — indicator stays in default (off) state
    });
  }

  // Initialize chatbot functionality
  initChatbot(block, shopPilot);
}

function initChatbot(block, shopPilot) {
  const messagesContainer = block.querySelector('.chatbot-messages');
  const input = block.querySelector('.chatbot-input');
  const sendBtn = block.querySelector('.send-btn');
  const voiceBtn = block.querySelector('.voice-btn');
  const quickReplies = block.querySelectorAll('.quick-reply');
  const typingIndicator = block.querySelector('.typing-indicator');
  
  // Store current product list for number-based selection
  let currentProducts = [];
  
  // Voice recognition state
  let isRecording = false;
  let recognition = null;

  // Initialize Speech Recognition
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      if (voiceBtn) voiceBtn.style.display = 'none';
      return null;
    }

    const speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onstart = () => {
      isRecording = true;
      voiceBtn.classList.add('recording');
      voiceBtn.querySelector('.mic-icon').style.display = 'none';
      voiceBtn.querySelector('.mic-off-icon').style.display = 'block';
      input.placeholder = 'Listening...';
    };

    speechRecognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const { transcript } = event.results[i][0];
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Show interim results in input
      input.value = finalTranscript || interimTranscript;

      // Auto-send when final result is received
      if (finalTranscript) {
        setTimeout(() => {
          sendMessage(finalTranscript);
        }, 500);
      }
    };

    speechRecognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      stopRecording();
      
      if (event.error === 'not-allowed') {
        addMessage('Microphone access denied. Please allow microphone access to use voice search.', 'bot');
      } else if (event.error === 'no-speech') {
        input.placeholder = 'No speech detected. Try again...';
        setTimeout(() => {
          input.placeholder = 'Type your message...';
        }, 2000);
      }
    };

    speechRecognition.onend = () => {
      stopRecording();
    };

    return speechRecognition;
  }

  function startRecording() {
    if (!recognition) {
      recognition = initSpeechRecognition();
    }
    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  }

  function stopRecording() {
    isRecording = false;
    if (voiceBtn) {
      voiceBtn.classList.remove('recording');
      const micIcon = voiceBtn.querySelector('.mic-icon');
      const micOffIcon = voiceBtn.querySelector('.mic-off-icon');
      if (micIcon) micIcon.style.display = 'block';
      if (micOffIcon) micOffIcon.style.display = 'none';
    }
    input.placeholder = 'Type your message...';
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        // Already stopped
      }
    }
  }

  // Voice button click handler
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });
  }

  // Initialize speech recognition on load
  recognition = initSpeechRecognition();

  // Focus input on load
  setTimeout(() => {
    input.focus();
    scrollToBottom();
  }, 100);

  // Send message function
  async function sendMessage(text) {
    if (!text.trim()) return;

    // Check if message contains a number reference to a product
    const numberMatch = text.match(/\b(\d+)\b/);
    if (numberMatch && currentProducts.length > 0) {
      const productIndex = parseInt(numberMatch[1]) - 1;
      if (productIndex >= 0 && productIndex < currentProducts.length) {
        const product = currentProducts[productIndex];
        // Replace number with SKU in the message
        text = text.replace(numberMatch[1], product.sku);
      }
    }

    // Add user message
    addMessage(text, 'user');
    input.value = '';

    // Show typing indicator
    showTypingIndicator();

    try {
      let response;
      
      // Process with ShopPilot AI if available
      if (shopPilot) {
        response = await shopPilot.process(text);
        console.log('[ShopPilot] Response received:', response);
      } else {
        // Fallback response
        response = {
          success: true,
          message: getFallbackResponse(text),
        };
      }
      
      hideTypingIndicator();
      
      console.log('[ShopPilot] Processing response - success:', response.success, 'displayAs:', response.displayAs, 'intent:', response.intent, 'action:', response.action);
      
      if (response.success) {
        // Show processing steps if multi-intent query
        if (response.processingSteps && response.processingSteps.length > 1) {
          displayProcessingSteps(response.processingSteps);
        }
        
        // Check if response should be displayed as UI component
        if (response.displayAs === 'ui' && (response.intent === 'product_search' || response.action === 'product_search')) {
          // Render product list UI
          const products = response.data?.items || response.data[0]?.data?.items || [];
          renderProductListUI(products);
          
          // If there's a message (e.g., from auto-completed action), show it
          if (response.message) {
            addMessage(response.message, 'bot');
          }
        } else if (response.displayAs === 'ui' && (response.intent === 'view_orders' || response.action === 'view_orders')) {
          // Render order list UI
          console.log('[ShopPilot] Rendering order list UI with data:', response.data);
          console.log('[ShopPilot] First order details:', response.data?.[0]);
          const orders = response.data || [];
          renderOrderListUI(orders);
          
          // If there's a message, show it
          if (response.message) {
            addMessage(response.message, 'bot');
          }
        } else if (response.message) {
          // Show text message
          console.log('[ShopPilot] Showing text message:', response.message);
          addMessage(response.message, 'bot');
        }
        
        // If there's additional data (like products), handle it
        // Skip this if we already rendered a UI component
        if (response.displayAs !== 'ui' && response.data && response.data.length > 0) {
          response.data.forEach((item) => {
            if (item.type === 'product' && item.products) {
              displayProducts(item.products);
            }
          });
        }
      } else {
        addMessage(response.message || 'Sorry, I couldn\'t understand that. Could you rephrase?', 'bot');
      }
    } catch (error) {
      hideTypingIndicator();
      addMessage('Sorry, I encountered an error. Please try again.', 'bot');
      console.error('ShopPilot error:', error);
    }
  }

  // Add message to chat
  function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const time = new Date().toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });

    if (sender === 'bot') {
      messageDiv.innerHTML = `
        <div class="message-avatar">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        </div>
        <div class="message-content">
          <div class="message-bubble">
            <p>${text}</p>
          </div>
          <span class="message-time">${time}</span>
        </div>
      `;
    } else {
      messageDiv.innerHTML = `
        <div class="message-content">
          <div class="message-bubble">
            <p>${text}</p>
          </div>
          <span class="message-time">${time}</span>
        </div>
      `;
    }

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    // Add animation
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(10px)';
    setTimeout(() => {
      messageDiv.style.transition = 'all 0.3s ease';
      messageDiv.style.opacity = '1';
      messageDiv.style.transform = 'translateY(0)';
    }, 10);
  }

  // Fallback response generator
  function getFallbackResponse(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('product') || lowerText.includes('shop')) {
      return "I'd be happy to help you find products! What are you looking for? 🛍️";
    }
    if (lowerText.includes('order') || lowerText.includes('track')) {
      return "I can help you track your order! Please provide your order number. 📦";
    }
    if (lowerText.includes('hello') || lowerText.includes('hi')) {
      return "Hello! How can I assist you with your shopping today? 👋";
    }
    return "Thanks for your message! How can I help you today? 😊";
  }

  // Render ProductListUI component
  function renderProductListUI(products) {
    // Store products for number-based selection
    currentProducts = products;
    
    const container = document.createElement('div');
    container.className = 'product-list-container';
    
    ProductListUI.render(container, products, (product, index) => {
      // Handle product selection - trigger add to cart
      sendMessage(`add ${product.sku} to cart`);
    });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message products-ui-message';
    messageDiv.innerHTML = `
      <div class="message-content">
      </div>
    `;
    messageDiv.querySelector('.message-content').appendChild(container);
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    // Add helper message
    setTimeout(() => {
      addMessage('💡 Tip: You can say "add 1 to cart" or "add 3 to wishlist" to select a product by number.', 'bot');
    }, 500);
  }

  // Render OrderListUI component
  function renderOrderListUI(orders) {
    console.log('[ShopPilot] renderOrderListUI called with orders:', orders);
    
    const container = document.createElement('div');
    container.className = 'order-list-container';
    
    OrderListUI.render(container, orders);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message orders-ui-message';
    messageDiv.innerHTML = `
      <div class="message-content">
      </div>
    `;
    messageDiv.querySelector('.message-content').appendChild(container);
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    console.log('[ShopPilot] Order list UI rendered');
    
    // Add count message if there are orders
    if (orders.length > 0) {
      setTimeout(() => {
        addMessage(`📦 You have ${orders.length} order${orders.length !== 1 ? 's' : ''}`, 'bot');
      }, 300);
    }
  }

  // Display processing steps for multi-intent queries
  function displayProcessingSteps(steps) {
    const stepsHTML = steps.map(step => 
      `<div class="processing-step">
        <span class="step-number">${step.step}</span>
        <span class="step-action">${step.action}</span>
      </div>`
    ).join('');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message processing-steps-message';
    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="message-bubble">
          <div class="processing-steps-header">🔄 Processing your request:</div>
          <div class="processing-steps-list">
            ${stepsHTML}
          </div>
        </div>
      </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  // Display products in chat
  function displayProducts(products) {
    if (!products || products.length === 0) return;
    
    const productsHTML = `
      <div class="products-carousel">
        ${products.slice(0, 5).map((product) => `
          <div class="product-card">
            ${product.image ? `<img src="${product.image}" alt="${product.name}" />` : ''}
            <h4>${product.name}</h4>
            ${product.price ? `<p class="price">$${product.price}</p>` : ''}
            ${product.url ? `<a href="${product.url}" class="view-product">View Details</a>` : ''}
          </div>
        `).join('')}
      </div>
    `;
    
    const productDiv = document.createElement('div');
    productDiv.className = 'message bot-message products-message';
    productDiv.innerHTML = `
      <div class="message-content">
        ${productsHTML}
      </div>
    `;
    
    messagesContainer.appendChild(productDiv);
    scrollToBottom();
  }

  // Typing indicator

  // Typing indicator
  function showTypingIndicator() {
    typingIndicator.style.display = 'flex';
    scrollToBottom();
  }

  function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
  }

  // Scroll to bottom
  function scrollToBottom() {
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
  }

  // Send button click
  sendBtn.addEventListener('click', () => {
    sendMessage(input.value);
  });

  // Enter key to send
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage(input.value);
    }
  });

  // Quick replies
  quickReplies.forEach(reply => {
    reply.addEventListener('click', () => {
      const message = reply.dataset.message;
      sendMessage(message);
    });
  });

  // Auto-resize input
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  });
}
