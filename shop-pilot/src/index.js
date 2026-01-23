import DLM from './nlp/dlm.js';
import IntentDetector from './nlp/intentDetector.js';
import ConfidenceScorer from './nlp/confidence.js';
import Clarification from './nlp/clarification.js';
import ActionExecutor from './actions/executor.js';
import Logger from './utils/logger.js';
import config from '../config/config.js';

/**
 * Main Shop Pilot Chatbot Class
 * Orchestrates the entire NLP → Action pipeline
 */
export default class ShopPilot {
  constructor() {
    this.dlm = new DLM();
    this.intentDetector = new IntentDetector();
    this.confidenceScorer = new ConfidenceScorer();
    this.clarification = new Clarification();
    this.executor = new ActionExecutor();
    this.logger = new Logger();
    
    this.conversationContext = {
      history: [],
      currentIntent: null,
      awaitingClarification: false,
      lastProducts: []
    };
  }

  /**
   * Main processing pipeline
   * @param {string} userInput - Raw user input
   * @returns {Promise<Object>} Response object
   */
  async process(userInput) {
    this.logger.info('Processing user input:', userInput);

    try {
      // Step 1: Domain Language Model processing
      const dlmOutput = await this.dlm.process(userInput);
      this.logger.debug('DLM output:', dlmOutput);

      // Step 2: Multi-intent detection
      const intents = this.intentDetector.detect(dlmOutput);
      this.logger.debug('Detected intents:', intents);

      // Step 3: Confidence scoring
      const scoredIntents = this.confidenceScorer.score(intents);
      this.logger.debug('Scored intents:', scoredIntents);

      // Step 4: Check if clarification needed
      if (this.needsClarification(scoredIntents)) {
        const clarificationResponse = this.clarification.generate(scoredIntents);
        this.conversationContext.awaitingClarification = true;
        return clarificationResponse;
      }

      // Step 5: Execute actions
      const results = await this.executor.execute(scoredIntents);
      this.logger.info('Action results:', results);

      // Update conversation context
      this.conversationContext.history.push({
        input: userInput,
        intents: scoredIntents,
        results
      });

      return this.formatResponse(results);
    } catch (error) {
      this.logger.error('Processing error:', error);
      return {
        success: false,
        message: '⚠️ Sorry, I encountered an error. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Check if clarification is needed based on confidence scores
   */
  needsClarification(scoredIntents) {
    if (scoredIntents.length === 0) return true;
    
    const topIntent = scoredIntents[0];
    return topIntent.confidence < config.thresholds.clarificationNeeded;
  }

  /**
   * Format final response for user
   */
  formatResponse(results) {
    if (!results || results.length === 0) {
      return {
        success: false,
        message: "I couldn't process that request. Can you rephrase?"
      };
    }

    const messages = results.map(r => r.message).join('\n\n');
    return {
      success: true,
      message: messages,
      data: results
    };
  }

  /**
   * Get conversation context
   */
  getContext() {
    return this.conversationContext;
  }

  /**
   * Reset conversation
   */
  reset() {
    this.conversationContext = {
      history: [],
      currentIntent: null,
      awaitingClarification: false,
      lastProducts: []
    };
  }
}
