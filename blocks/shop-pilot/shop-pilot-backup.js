/**
 * Shop Pilot Block
 * AI-powered shopping assistant for enhanced customer experience
 */

export default async function decorate(block) {
  console.log('🛍️ Initializing Shop Pilot block...');
  
  // Clear any existing content
  block.innerHTML = '';
  block.classList.add('shop-pilot');
  
  // Create the main container
  const container = document.createElement('div');
  container.classList.add('shop-pilot-container');

  // Create header
  const header = document.createElement('div');
  header.classList.add('shop-pilot-header');
  header.innerHTML = `
    <div class="header-content">
      <h1>🛍️ Shop Pilot</h1>
      <p>Your AI-powered shopping assistant</p>
    </div>
  `;

  // Create chat messages area
  const chatMessages = document.createElement('div');
  chatMessages.classList.add('shop-pilot-messages');
  chatMessages.id = 'shop-pilot-messages';
  chatMessages.innerHTML = `
    <div class="message assistant">
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <p>👋 Welcome! I'm your Shop Pilot assistant.</p>
        <p>I can help you:</p>
        <ul>
          <li>🔍 Find the perfect products</li>
          <li>💡 Get personalized recommendations</li>
          <li>🛒 Manage your shopping cart</li>
          <li>❤️ Save items to your wishlist</li>
        </ul>
        <p>What are you looking for today?</p>
      </div>
    </div>
  `;

  // Assemble the block
  container.appendChild(header);
  container.appendChild(chatMessages);
  block.appendChild(container);
  
  // Create and append fixed input after a short delay to ensure DOM is ready
  setTimeout(() => {
    // Check if input already exists
    if (!document.getElementById('shop-pilot-input-fixed')) {
      const chatInput = document.createElement('div');
      chatInput.classList.add('shop-pilot-input-fixed');
      chatInput.id = 'shop-pilot-input-fixed';
      chatInput.innerHTML = `
        <div class="input-wrapper">
          <div class="input-container">
            <input 
              type="text" 
              id="shop-pilot-input" 
              class="chat-input" 
              placeholder="Ask me anything... (e.g., 'Find me a blue shirt')"
            />
            <button id="shop-pilot-send" class="chat-send-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(chatInput);
      console.log('✅ Fixed input appended to body');
    }
    
    // Initialize functionality
    inole.log('🔧 Initializing Shop Pilot functionality...');
  
  const chatInput = document.getElementById('shop-pilot-input');
  const chatSend = document.getElementById('shop-pilot-send');
  const chatMessages = document.getElementById('shop-pilot-messages');

  if (!chatInput || !chatSend || !chatMessages) {
    console.error('❌ Shop Pilot elements not found:', { chatInput, chatSend, chatMessages });
    return;
  }

  console.log('✅ All elements found');

  // Create agent instance
  const agent = new ShopPilotAgent();

  // Handle send button click
  chatSend.addEventListener('click', () => {
    handleSendMessage(chatInput, chatMessages, agent);
  });

  // Handle enter key
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage(chatInput, chatMessages, agent);
    }
  });
  
  console.log('✅ Event listeners attached'); });
  }

  // Handle enter key
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSendMessage(chatInput, chatMessages, agent);
      }
    });
  }
}

/**
 * Shop Pilot Agent
 */
class ShopPilotAgent {
  constructor() {
    this.state = {
      messages: [],
      context: {},
    };
  }

  async process(userMessage) {
    this.state.messages.push(userMessage);

    // Basic response for now
    return `✨ I received: "${userMessage}". Shop Pilot is ready to help!`;
  }
}

/**
 * Handle sending a message
 */
async function handleSendMessage(inputElement, messagesContainer, agent) {
  const message = inputElement.value.trim();

  if (!message) return;

  // Add user message
  addMessage('user', message, messagesContainer);
  inputElement.value = '';

  // Show typing indicator
  addTypingIndicator(messagesContainer);

  try {
    const response = await agent.process(message);
    removeTypingIndicator();
  // Add avatar
  const avatar = document.createElement('div');
  avatar.classList.add('message-avatar');
  avatar.textContent = type === 'user' ? '👤' : '🤖';

  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  messageContent.innerHTML = `<p>${content}</p>`;

  messageDiv.appendChild(avatar);    removeTypingIndicator();
    addMessage('assistant', '⚠️ Sorry, I encountered an error. Please try again.', messagesContainer);
  }
}

/**
 * Add a message to the chat
 */
function addMessage(type, content, container) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', type);

  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  messageContent.innerHTML = `<p>${content}</p>`;

  messageDiv.appendChild(messageContent);
  container.appendChild(messageDiv);

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

/**
 * Add typing indicator
 */
function addTypingIndicator(container) {
  const indicator = document.createElement('div');
  indicator.classList.add('message', 'assistant', 'typing-indicator');
  indicator.id = 'shop-pilot-typing';
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
  const indicator = document.getElementById('shop-pilot-typing');
  if (indicator) {
    indicator.remove();
  }
}
