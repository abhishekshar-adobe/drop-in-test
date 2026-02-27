/**
 * LLM Configuration for Ollama (Llama 3.1 8B)
 *
 * Prerequisites:
 *   1. Install Ollama: https://ollama.com/download
 *   2. Pull the model: `ollama pull llama3.1`
 *   3. Start the server: `ollama serve`
 *   4. For browser CORS, set env var before starting Ollama:
 *        export OLLAMA_ORIGINS="*"
 *        ollama serve
 */
export default {
  // Toggle LLM on/off — when false, the rule-based pipeline is used exclusively
  enabled: true,

  // Ollama server endpoint
  endpoint: 'http://localhost:11434',

  // Model identifier (must be pulled locally via `ollama pull <model>`)
  model: 'llama3.1',

  // --- Input Processing (intent detection & entity extraction) ---
  input: {
    // Low temperature → deterministic, structured JSON output
    temperature: 0.3,
    maxTokens: 512,
    // Timeout for input processing calls (ms)
    timeout: 8000,
  },

  // --- Output Generation (natural language responses) ---
  output: {
    // Higher temperature → natural variation in responses
    temperature: 0.7,
    maxTokens: 256,
    // Timeout for output generation calls (ms)
    timeout: 6000,
  },

  // --- Resilience ---
  // Fall back to rule-based pipeline on LLM failure
  fallbackOnError: true,
  // Number of retries before falling back
  maxRetries: 1,
  // Health-check interval (ms) — how often to re-check Ollama availability
  healthCheckInterval: 30000,
};
