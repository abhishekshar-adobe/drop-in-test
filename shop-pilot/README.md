# Shop Pilot - AI E-commerce Chatbot

Multi-layer NLP architecture for intelligent e-commerce conversations.

## Architecture Flow

```
User Input → Tokenizer → DLM → Intent Detector → Confidence Scorer
                                                        ↓
                                    High → Executor → E-commerce API
                                                        ↓
                                    Low → Clarification → User
```

## Features

- **Multi-Intent Detection**: Handle complex queries with multiple intents
- **Entity Extraction**: Products, quantities, prices, attributes
- **Confidence Scoring**: Smart clarification when uncertain
- **Fuzzy Matching**: Typo correction and synonym handling
- **Domain Language Model**: E-commerce specialized NLP

## Quick Start

```javascript
import ShopPilot from './src/index.js';

const bot = new ShopPilot();
const response = await bot.process("search for red shoes size 10");
console.log(response.message);
```

## Configuration

Edit `config/config.js` to adjust:
- Confidence thresholds
- API endpoints
- NLP parameters

## Project Structure

- `src/index.js` - Main orchestrator
- `src/nlp/` - NLP pipeline (DLM, intent detection, confidence scoring)
- `src/actions/` - Action execution and API integration
- `src/utils/` - Utilities (tokenizer, logger, helpers)
- `config/` - Configuration files
