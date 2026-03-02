export default function decorate(block) {
  // Create chatbot container structure
  const chatbotHTML = `
    <div class="chatbot-container">
      <button class="chatbot-toggle" aria-label="Open chatbot">
        <svg class="chat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <svg class="close-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      
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
          </div>
          <button class="minimize-btn" aria-label="Minimize chat">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
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
                <p>Hi! 👋 I'm your AI assistant. How can I help you today?</p>
              </div>
              <span class="message-time">Just now</span>
            </div>
          </div>
        </div>
        
        <div class="quick-replies">
          <button class="quick-reply" data-message="Tell me about your products">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            Products
          </button>
          <button class="quick-reply" data-message="I need help with my order">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Help
          </button>
          <button class="quick-reply" data-message="What are your business hours?">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Hours
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

  block.innerHTML = chatbotHTML;

  // Initialize chatbot functionality
  initChatbot(block);
}

function initChatbot(block) {
  const toggle = block.querySelector('.chatbot-toggle');
  const chatWindow = block.querySelector('.chatbot-window');
  const messagesContainer = block.querySelector('.chatbot-messages');
  const input = block.querySelector('.chatbot-input');
  const sendBtn = block.querySelector('.send-btn');
  const voiceBtn = block.querySelector('.voice-btn');
  const quickReplies = block.querySelectorAll('.quick-reply');
  const minimizeBtn = block.querySelector('.minimize-btn');
  const typingIndicator = block.querySelector('.typing-indicator');

  let isOpen = false;
  let isRecording = false;
  let recognition = null;

  // Initialize Speech Recognition
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      voiceBtn.style.display = 'none';
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

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
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
        addMessage('Microphone access denied. Please allow microphone access to use voice input.', 'bot');
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
    voiceBtn.classList.remove('recording');
    voiceBtn.querySelector('.mic-icon').style.display = 'block';
    voiceBtn.querySelector('.mic-off-icon').style.display = 'none';
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
  voiceBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // Toggle chatbot window
  toggle.addEventListener('click', () => {
    isOpen = !isOpen;
    toggle.classList.toggle('active', isOpen);
    chatWindow.classList.toggle('active', isOpen);
    
    if (isOpen) {
      input.focus();
      scrollToBottom();
    }
  });

  // Minimize button
  minimizeBtn.addEventListener('click', () => {
    isOpen = false;
    toggle.classList.remove('active');
    chatWindow.classList.remove('active');
  });

  // Send message function
  function sendMessage(text) {
    if (!text.trim()) return;

    // Add user message
    addMessage(text, 'user');
    input.value = '';

    // Show typing indicator
    showTypingIndicator();

    // Simulate bot response
    setTimeout(() => {
      hideTypingIndicator();
      const response = generateResponse(text);
      addMessage(response, 'bot');
    }, 1000 + Math.random() * 1000);
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

  // Generate bot response (customize with your logic)
  function generateResponse(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('product') || lowerMessage.includes('shop')) {
      return "I'd be happy to help you find products! You can browse our collection or tell me what you're looking for. 🛍️";
    } else if (lowerMessage.includes('order') || lowerMessage.includes('track')) {
      return "I can help you with your order! Please provide your order number, and I'll check the status for you. 📦";
    } else if (lowerMessage.includes('hour') || lowerMessage.includes('time')) {
      return "We're available 24/7 through this chat! Our customer service team is here Monday-Friday, 9 AM - 6 PM EST. ⏰";
    } else if (lowerMessage.includes('help')) {
      return "I'm here to help! You can ask me about products, orders, returns, or anything else. What would you like to know? 💁";
    } else if (lowerMessage.includes('return')) {
      return "Our return policy allows returns within 30 days of purchase. Would you like to initiate a return? 🔄";
    } else if (lowerMessage.includes('thank')) {
      return "You're welcome! Is there anything else I can help you with? 😊";
    } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return "Hello! Great to hear from you. How can I assist you today? 👋";
    } else {
      return "Thanks for your message! Let me connect you with the right information. Could you tell me more about what you need? 🤔";
    }
  }

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

  // Initialize speech recognition on load
  recognition = initSpeechRecognition();
}
