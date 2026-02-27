import llmConfig from '../../config/llm-config.js';
import Logger from '../utils/logger.js';

/**
 * Ollama LLM Service
 * Wraps the Ollama REST API for local LLM inference.
 * Provides health-checking, timeout handling, retries, and graceful fallback.
 */
export default class LLMService {
  constructor(configOverrides = {}) {
    this.config = { ...llmConfig, ...configOverrides };
    this.logger = new Logger();
    this._available = null; // null = unknown, true/false after check
    this._lastHealthCheck = 0;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Check whether Ollama is reachable and the target model is loaded.
   * Caches the result for `healthCheckInterval` ms.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    if (!this.config.enabled) return false;

    const now = Date.now();
    if (
      this._available !== null &&
      now - this._lastHealthCheck < this.config.healthCheckInterval
    ) {
      return this._available;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${this.config.endpoint}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        this._setAvailable(false);
        return false;
      }

      const data = await res.json();
      // Check if the configured model (or any tag starting with it) is present
      const modelBase = this.config.model.split(':')[0];
      const found = (data.models || []).some((m) =>
        m.name.startsWith(modelBase),
      );

      this._setAvailable(found);
      if (!found) {
        this.logger.warn(
          `Ollama is running but model "${this.config.model}" is not pulled. Run: ollama pull ${this.config.model}`,
        );
      }
      return found;
    } catch {
      this._setAvailable(false);
      return false;
    }
  }

  /**
   * Generate a completion from a single prompt string.
   * @param {string} prompt
   * @param {Object} [options] — temperature, maxTokens, timeout overrides
   * @returns {Promise<string|null>} Generated text, or null on failure
   */
  async generate(prompt, options = {}) {
    return this._callWithRetry(() => this._generate(prompt, options));
  }

  /**
   * Chat-style completion with system + user messages.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} [options]
   * @returns {Promise<string|null>}
   */
  async chat(messages, options = {}) {
    return this._callWithRetry(() => this._chat(messages, options));
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** @private */
  _setAvailable(val) {
    this._available = val;
    this._lastHealthCheck = Date.now();
  }

  /** @private retry wrapper */
  async _callWithRetry(fn) {
    const maxRetries = this.config.maxRetries ?? 1;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        this.logger.warn(
          `LLM call failed (attempt ${attempt + 1}/${maxRetries + 1}):`,
          err.message,
        );
        if (attempt === maxRetries) {
          this._setAvailable(false);
          return null;
        }
      }
    }
    return null;
  }

  /** @private */
  async _generate(prompt, options) {
    const timeout = options.timeout ?? this.config.input.timeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${this.config.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? this.config.input.temperature,
            num_predict: options.maxTokens ?? this.config.input.maxTokens,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      return data.response ?? null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** @private */
  async _chat(messages, options) {
    const timeout = options.timeout ?? this.config.output.timeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${this.config.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature ?? this.config.output.temperature,
            num_predict: options.maxTokens ?? this.config.output.maxTokens,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      return data.message?.content ?? null;
    } finally {
      clearTimeout(timer);
    }
  }
}
