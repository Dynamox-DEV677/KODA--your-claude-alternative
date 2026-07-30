/**
 * Provider interface. Every provider Koda talks to implements this shape.
 * Adding a new provider = one new class + one entry in config/models.json.
 * No provider-specific logic is allowed anywhere else in the codebase.
 *
 * chat({ model, messages, tools?, temperature?, maxTokens?, onToken? })
 *   -> Promise<{ content: string, toolCalls: Array|null, usage: object|null }>
 *   When onToken is given the provider streams and calls onToken(text) per chunk.
 *
 * listModels() -> Promise<string[]>
 */
export class BaseProvider {
  constructor(name) { this.name = name; }
  async chat() { throw new Error(`${this.name}: chat() not implemented`); }
  async listModels() { throw new Error(`${this.name}: listModels() not implemented`); }
}
