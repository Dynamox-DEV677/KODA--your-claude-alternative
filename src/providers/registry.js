import { OpenAICompatProvider } from './openaiCompat.js';

/**
 * Builds the active provider from config/models.json.
 * All current providers are OpenAI-compatible; a provider with a different
 * wire format (e.g. Anthropic, Gemini) gets its own class implementing
 * BaseProvider and a branch here — nothing else in the app changes.
 */
export function createProvider(cfg, name = cfg.provider) {
  const entry = cfg.providers[name];
  if (!entry) {
    throw new Error(`Unknown provider "${name}" — add it to config/models.json`);
  }
  const apiKey = entry.envKey ? process.env[entry.envKey] : undefined;
  if (entry.envKey && !apiKey) {
    throw new Error(`Missing ${entry.envKey} — put it in koda/.env`);
  }
  return new OpenAICompatProvider({ name, baseUrl: entry.baseUrl, apiKey });
}
