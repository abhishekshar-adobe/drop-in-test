export default {
  // Confidence thresholds
  thresholds: {
    highConfidence: 0.7,
    lowConfidence: 0.4,
    clarificationNeeded: 0.4
  },

  // API configuration
  api: {
    endpoint: 'https://www.aemshop.net/graphql',
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json'
    }
  },

  // NLP settings
  nlp: {
    fuzzyThreshold: 0.3,
    minMatchLength: 3,
    maxIntentsPerQuery: 3
  },

  // Logging
  logging: {
    enabled: true,
    level: 'info' // 'debug' | 'info' | 'warn' | 'error'
  }
};
