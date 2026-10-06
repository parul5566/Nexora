/**
 * Module 22 — AI provider abstraction.
 * Providers are swappable behind a single `complete(prompt)` interface.
 * When no provider is configured, features degrade honestly (AiUnavailableError).
 */

export class AiUnavailableError extends Error {
  constructor(message = 'AI services are not available') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export interface AiProvider {
  readonly available: boolean;
  complete(prompt: string): Promise<string>;
}

/** Deterministic provider for tests — no network. */
export class StaticProvider implements AiProvider {
  constructor(private fn: (prompt: string) => string) {}
  get available() { return true; }
  async complete(prompt: string) { return this.fn(prompt); }
}

/** OpenAI-compatible chat-completions provider (OpenAI-compatible gateways, self-hosted or hosted). */
export class OpenAICompatibleProvider implements AiProvider {
  private apiKey: string | undefined;
  private baseUrl: string;
  private model: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY;
    this.baseUrl = opts?.baseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    this.model = opts?.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  get available() { return !!this.apiKey; }

  async complete(prompt: string): Promise<string> {
    if (!this.apiKey) throw new AiUnavailableError();
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new AiUnavailableError(`AI upstream error ${res.status}`);
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new AiUnavailableError('Empty AI response');
    return text.trim();
  }
}

export function defaultProvider(): AiProvider {
  return new OpenAICompatibleProvider();
}
