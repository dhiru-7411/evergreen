// Shared Anthropic client and model settings.
//
//   ANTHROPIC_API_KEY   required for AI features (they're disabled without it)
//   AI_MODEL            defaults to claude-opus-5-5; set claude-haiku-5-5 to cut cost
//   AI_EFFORT           low | medium | high | xhigh | max (default high: accuracy matters here)
// (Not CLAUDE_*: tools like Claude Code set those in the shell, which would leak in.)
const AnthropicModule = require('@anthropic-ai/sdk');

const Anthropic = AnthropicModule.default ?? AnthropicModule;

let client = null;
let override = null;

const aiEnabled = () => Boolean(override || process.env.ANTHROPIC_API_KEY);

function getClient() {
  if (override) return override;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

const model = () => process.env.AI_MODEL || 'claude-opus-5-5';
const effort = () => process.env.AI_EFFORT || 'high';

// Server-side refusal fallback is supported on these models; on others we
// send a plain request.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5-5']);
const fallbackParams = () =>
  FALLBACK_MODELS.has(model()) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {};

// Test hook: inject a fake client.
const setClient = (fake) => {
  override = fake;
};

module.exports = { Anthropic, getClient, aiEnabled, model, effort, fallbackParams, setClient };
