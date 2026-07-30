/**
 * Model router. classify() maps a user message to a task type;
 * resolveModel() maps a route key to a concrete model id from config.
 * Routes are edited live with /route <task> <model> — no code changes needed.
 */

const RULES = [
  ['frontend',  /\b(website|landing\s*page|web\s*page|ui|ux|css|tailwind|component|dashboard|portfolio|animation|responsive|dark\s*mode|glassmorphism)\b/i],
  ['coding',    /\b(code|coding|bug|debug|error|function|refactor|test|script|regex|compile|python|typescript|javascript|react|node|rust|go(lang)?|java|sql|api|docker|git)\b/i],
  ['reasoning', /\b(math|prove|proof|logic|calculate|solve|equation|puzzle|step[\s-]*by[\s-]*step|architecture\s+decision)\b/i],
  ['research',  /\b(research|compare|comparison|vs\.?|summari[sz]e|documentation|docs|which\s+is\s+better|pros\s+and\s+cons)\b/i],
  ['design',    /\b(design\s+system|color\s+palette|typography|logo|icon|brand|ui\s+kit)\b/i],
];

export function classify(text) {
  for (const [task, re] of RULES) {
    if (re.test(text)) return task;
  }
  return text.length < 60 ? 'fast' : 'general';
}

export function resolveModel(cfg, routeKey) {
  return cfg.routes[routeKey] ?? cfg.routes.default;
}

export function isComplex(text) {
  if (text.length > 350) return true;
  return /\b(build|create|make|design|implement|generate|write)\b[\s\S]{0,80}\b(app|website|site|api|game|tool|dashboard|landing|server|bot|extension|full)\b/i.test(text);
}
