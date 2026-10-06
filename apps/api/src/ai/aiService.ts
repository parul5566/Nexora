/**
 * Module 22 — AI feature service.
 * Features are named prompt templates behind one `run(feature, input)` call.
 * Availability is reported honestly; unconfigured AI returns AI_UNAVAILABLE (503).
 */
import {
  AiProvider, AiUnavailableError, defaultProvider,
} from './aiProvider.js';

export interface AiResult {
  available: boolean;
  result?: string;
}

const FEATURES: Record<string, (input: string) => string> = {
  // post-assist: clean up grammar and tighten wording
  write: (input) =>
    `Improve the following text for clarity and grammar. Reply with ONLY the improved text, no commentary:\n\n${input}`,
  // summarize long content
  summarize: (input) =>
    `Summarize the following in at most 3 sentences. Reply with ONLY the summary:\n\n${input}`,
  // suggest hashtags
  hashtags: (input) =>
    `Suggest 3-5 relevant hashtags (single words, no spaces, no # prefix) for this post. Reply with ONLY the hashtags separated by spaces:\n\n${input}`,
};

export class AiService {
  constructor(private provider: AiProvider = defaultProvider()) {}

  get available() { return this.provider.available; }

  /** Runs a named feature; throws AiUnavailableError when no provider is configured. */
  async run(feature: string, input: string): Promise<AiResult> {
    if (!this.provider.available) throw new AiUnavailableError();
    const template = FEATURES[feature];
    if (!template) throw new AiUnavailableError(`Unknown AI feature: ${feature}`);
    const result = await this.provider.complete(template(input.trim()));
    return { available: true, result };
  }

  listFeatures(): string[] { return Object.keys(FEATURES); }
}

export const aiService = new AiService();
