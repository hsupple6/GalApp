/**
 * Utility functions for processing and optimizing prompts
 */

/**
 * Processes a raw writing sample into an effective system prompt.
 * This transforms a potentially lengthy or unfocused writing sample
 * into a more structured prompt that guides the model better.
 */
export function processWritingSampleToSystemPrompt(writingSample: string): string {
  if (!writingSample || writingSample.trim().length === 0) {
    return '';
  }

  // Truncate if too long (most LLMs have system prompt size limits)
  const MAX_LENGTH = 4000;
  const truncatedSample = writingSample.length > MAX_LENGTH
    ? writingSample.substring(0, MAX_LENGTH) + '...'
    : writingSample;

  // Create a structured system prompt
  const systemPrompt = `
You are an AI assistant that adopts the writing style, tone, and knowledge reflected in the following writing sample. 
When responding to queries, emulate this style while maintaining factual accuracy:

====== WRITING SAMPLE ======
${truncatedSample}
============================

Use the writing sample to inform your tone, style, vocabulary choices, and sentence structure, 
but don't reference the writing sample directly in your responses unless specifically asked about it.
Maintain your competence and knowledge while adopting the stylistic elements from the sample.
`.trim();

  return systemPrompt;
}

/**
 * A simpler version that just wraps the writing sample with minimal instructions
 */
export function createSimpleSystemPrompt(writingSample: string): string {
  if (!writingSample || writingSample.trim().length === 0) {
    return '';
  }
  
  // Truncate if too long (most LLMs have system prompt size limits)
  const MAX_LENGTH = 4000;
  const truncatedSample = writingSample.length > MAX_LENGTH
    ? writingSample.substring(0, MAX_LENGTH) + '...'
    : writingSample;

  return `Respond in the style of the following writing sample: ${truncatedSample}`;
} 