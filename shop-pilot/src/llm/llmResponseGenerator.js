import LLMService from './llmService.js';
import { buildResponseMessages } from './prompts.js';
import { formatNaturalResponse, shouldFormatNaturally } from '../utils/responseFormatter.js';
import Logger from '../utils/logger.js';

/**
 * LLM Response Generator
 * Uses Ollama (Llama 3.1) to produce conversational, natural-sounding
 * responses instead of the template-based responseFormatter.
 *
 * Falls back to the existing template system on any failure.
 */
export default class LLMResponseGenerator {
  constructor(llmService) {
    this.llm = llmService || new LLMService();
    this.logger = new Logger();
  }

  /**
   * Generate a natural language response for a completed action.
   *
   * @param {string} intentName — executed intent name
   * @param {Object} actionResult — raw result from ActionExecutor.executeIntent()
   * @param {Array}  conversationHistory — recent exchanges
   * @returns {Promise<string|null>} Natural text, or null to use the template fallback
   */
  async formatResponse(intentName, actionResult, conversationHistory = []) {
    // Don't use LLM for UI-display responses (product grids, order lists)
    if (actionResult.displayAs === 'ui') {
      return null;
    }

    try {
      const available = await this.llm.isAvailable();
      if (!available) {
        this.logger.debug('LLM not available, falling back to templates');
        return null;
      }

      const startTime = Date.now();

      const messages = buildResponseMessages(
        intentName,
        actionResult,
        conversationHistory,
      );

      const response = await this.llm.chat(messages, {
        temperature: 0.7,
        timeout: 6000,
      });

      if (!response) {
        this.logger.warn('LLM returned empty response for output generation');
        return null;
      }

      this.logger.debug(
        `LLM response generation took ${Date.now() - startTime}ms`,
      );

      // Basic sanity check — response shouldn't be absurdly long or contain JSON
      const cleaned = this._sanitize(response);
      if (!cleaned) return null;

      return cleaned;
    } catch (err) {
      this.logger.warn('LLM response generation failed:', err.message);
      return null;
    }
  }

  /**
   * High-level helper: try LLM first, fall back to template-based formatter.
   * This is the primary method called by the pipeline.
   *
   * @param {string} intentName
   * @param {Object} actionResult
   * @param {Array}  conversationHistory
   * @returns {Promise<string>} Always returns a usable message
   */
  async generateOrFallback(intentName, actionResult, conversationHistory = []) {
    // Try LLM generation
    const llmResponse = await this.formatResponse(
      intentName,
      actionResult,
      conversationHistory,
    );

    if (llmResponse) return llmResponse;

    // Fall back to template-based formatting
    if (shouldFormatNaturally(actionResult)) {
      const templateResponse = formatNaturalResponse(intentName, actionResult);
      if (templateResponse) return templateResponse;
    }

    // Ultimate fallback — return the raw message from the executor
    return actionResult.message || '';
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Sanitize the LLM response:
   *  - Strip code fences
   *  - Reject if it looks like JSON or code
   *  - Trim and limit length
   */
  _sanitize(text) {
    if (!text || typeof text !== 'string') return null;

    let cleaned = text.trim();

    // Remove code fences
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:\w+)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim();
    }

    // Reject if it looks like raw JSON
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
      this.logger.warn('LLM returned JSON instead of natural text, rejecting');
      return null;
    }

    // Reject if unreasonably long (>500 chars for a chat message)
    if (cleaned.length > 500) {
      cleaned = cleaned.slice(0, 497) + '...';
    }

    // Reject empty
    if (cleaned.length === 0) return null;

    return cleaned;
  }
}
