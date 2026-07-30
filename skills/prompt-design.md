---
name: prompt-design
description: Writing prompts and building AI features into apps
triggers: prompt, llm, ai feature, chatbot, gpt, system prompt, ai integration
---
Design prompts and AI integrations that behave predictably.

PROMPT STRUCTURE (in order): role + goal in one sentence → hard rules as a short list (what it must NEVER do first) → output format with an EXACT example → 1-2 few-shot examples if the format is unusual. Put instructions BEFORE the data being processed, and label the data clearly ("USER MESSAGE:", "DOCUMENT:").

RULES THAT ACTUALLY MOVE QUALITY:
- Show the output format as a literal example, not a description. For JSON: give the exact shape and say "reply with ONLY the JSON, no markdown fences, no commentary."
- Constrain length explicitly ("2 sentences", "max 5 items") — models pad by default.
- One prompt = one job. Chained small prompts beat one mega-prompt.
- Tell it what to do on failure: "if the answer is not in the text, reply exactly UNKNOWN" — otherwise it hallucinates.
- Temperature: 0-0.3 for extraction/classification/JSON, 0.6-0.8 for writing/ideas.

INTEGRATION ENGINEERING:
- Always parse defensively: strip markdown fences before JSON.parse, try/catch, retry once with "Your last reply was invalid JSON. Reply with only valid JSON." on failure.
- Set max_tokens appropriate to the task; stream anything user-facing.
- Timeouts + one retry with backoff on 429/5xx; a fallback model or graceful error message after that.
- Log prompts+responses during development — you cannot fix what you can't see.
- Never put API keys in frontend code; the browser calls YOUR endpoint, your server calls the model.
