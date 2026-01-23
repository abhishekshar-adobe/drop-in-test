/**
 * Tokenizer
 * Text normalization and tokenization
 */
export default {
  /**
   * Normalize and tokenize text
   * @param {string} text - Raw input text
   * @returns {Array} Array of normalized tokens
   */
  normalize(text) {
    // Convert to lowercase
    let normalized = text.toLowerCase();

    // Remove special characters but keep spaces
    normalized = normalized.replace(/[^\w\s]/g, ' ');

    // Split into tokens
    const tokens = normalized
      .split(/\s+/)
      .filter(token => token.length > 0)
      .filter(token => !this.isStopWord(token));

    return tokens;
  },

  /**
   * Check if word is a stop word
   */
  isStopWord(word) {
    const stopWords = [
      'a', 'an', 'the', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'should',
      'can', 'could', 'may', 'might', 'must',
      'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'me', 'him', 'her', 'us', 'them',
      'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'this', 'that', 'these', 'those',
      'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'from', 'by', 'about', 'as', 'into', 'through'
    ];

    return stopWords.includes(word);
  },

  /**
   * Extract entities from text
   */
  extractEntities(text, patterns) {
    const entities = {};

    Object.entries(patterns).forEach(([name, pattern]) => {
      const match = text.match(pattern);
      if (match) {
        entities[name] = match[1] || match[0];
      }
    });

    return entities;
  },

  /**
   * Calculate similarity between two strings
   */
  similarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  },

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
};
