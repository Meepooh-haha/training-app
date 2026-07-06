// Singleton Anthropic client — imported by route handlers.
// API key comes from ANTHROPIC_API_KEY environment variable.

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default anthropic;
