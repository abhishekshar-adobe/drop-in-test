import config from '../../config/config.js';

/**
 * Confidence Scorer
 * Assigns confidence scores to detected intents
 */
export default class ConfidenceScorer {
  /**
   * Score intents based on multiple factors
   * @param {Array} intents - Detected intents
   * @returns {Array} Intents with confidence scores
   */
  score(intents) {
    return intents.map(intent => {
      let confidence = intent.rawScore;

      // Factor 1: Required slots present?
      const slotsPresent = this.checkRequiredSlots(intent);
      if (!slotsPresent) {
        confidence *= 0.7; // Reduce confidence if slots missing
      }

      // Factor 2: Entity quality
      const entityQuality = this.assessEntityQuality(intent.entities);
      confidence *= entityQuality;

      // Factor 3: Normalize to 0-1 range
      confidence = Math.min(Math.max(confidence, 0), 1);

      return {
        ...intent,
        confidence,
        confidenceLevel: this.getConfidenceLevel(confidence)
      };
    });
  }

  /**
   * Check if required slots are present
   */
  checkRequiredSlots(intent) {
    if (!intent.requiredSlots || intent.requiredSlots.length === 0) {
      return true;
    }

    return intent.requiredSlots.every(slot => {
      const value = intent.entities[slot];
      return value !== undefined && value !== null && value !== '';
    });
  }

  /**
   * Assess quality of extracted entities
   */
  assessEntityQuality(entities) {
    let quality = 1.0;

    Object.values(entities).forEach(value => {
      if (!value || value === '' || (Array.isArray(value) && value.length === 0)) {
        quality *= 0.8;
      }
    });

    return quality;
  }

  /**
   * Get confidence level label
   */
  getConfidenceLevel(confidence) {
    if (confidence >= config.thresholds.highConfidence) {
      return 'high';
    } else if (confidence >= config.thresholds.lowConfidence) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}
