import { BaseProvider } from './base.js';

/**
 * Generic OpenAI-compatible chat-completions provider.
 * Covers NVIDIA, Groq, OpenRouter, Together, OpenAI and local Ollama —
 * they all speak the same /chat/completions dialect.
 */
export class OpenAICompatProvider extends BaseProvider {
  constructor({ name, baseUrl, apiKey }) {
    super(name);
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  headers() {
    const h = { 'content-type': 'application/json' };
    if (this.apiKey) h.authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  async chat({ model, messages, tools, temperature = 0.6, maxTokens = 4096, onToken }) {
    const stream = typeof onToken === 'function';
    const body = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    // Idle-based timeout: abort only when the model goes SILENT, so a slow
    // but steadily streaming response is never killed mid-answer.
    const idleMs = stream ? 120000 : 240000;
    const ctrl = new AbortController();
    let idleTimer;
    const arm = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () => ctrl.abort(new Error(`${this.name} timeout: no data for ${idleMs / 1000}s (free tier congestion — retry, or /model a lighter one)`)),
        idleMs,
      );
    };

    try {
      // retry transient failures (rate limits, overload) with backoff
      let res;
      for (let attempt = 0; ; attempt++) {
        arm();
        res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (res.ok) break;
        const retryable = [429, 500, 502, 503, 504, 529].includes(res.status);
        if (!retryable || attempt >= 4) {
          const text = await res.text().catch(() => '');
          throw new Error(`${this.name} ${res.status}: ${text.slice(0, 300) || res.statusText}`);
        }
        await res.text().catch(() => '');
        const waits = [2000, 5000, 12000, 25000];
        await new Promise((r) => setTimeout(r, waits[attempt]));
      }

      if (!stream) {
        arm();
        const json = await res.json();
        const msg = json.choices?.[0]?.message ?? {};
        return {
          content: msg.content ?? '',
          toolCalls: msg.tool_calls?.length ? msg.tool_calls : null,
          usage: json.usage ?? null,
        };
      }

      return await this.#consumeStream(res, onToken, arm);
    } catch (e) {
      // surface our idle-timeout reason instead of a generic AbortError
      throw ctrl.signal.aborted && ctrl.signal.reason instanceof Error ? ctrl.signal.reason : e;
    } finally {
      clearTimeout(idleTimer);
    }
  }

  async #consumeStream(res, onToken, arm = () => {}) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let content = '';
    const toolAcc = new Map(); // index -> {id, type, function:{name, arguments}}
    let usage = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      arm(); // data arrived — reset the idle timeout
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let json;
        try { json = JSON.parse(data); } catch { continue; }
        if (json.usage) usage = json.usage;
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.reasoning_content) onToken(`<think>${delta.reasoning_content}</think>`);
        if (delta.content) { content += delta.content; onToken(delta.content); }
        for (const tc of delta.tool_calls ?? []) {
          const slot = toolAcc.get(tc.index) ?? { id: '', type: 'function', function: { name: '', arguments: '' } };
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.function.name += tc.function.name;
          if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
          toolAcc.set(tc.index, slot);
        }
      }
    }

    const toolCalls = toolAcc.size ? [...toolAcc.values()] : null;
    return { content, toolCalls, usage };
  }

  async listModels() {
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`${this.name} ${res.status}: could not list models`);
    const json = await res.json();
    return (json.data ?? []).map((m) => m.id).sort();
  }
}
