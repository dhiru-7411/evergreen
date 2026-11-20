// Drafts a learning path for a topic with Claude, grounded in the official docs.
//
// How accuracy is enforced:
// 1. Claude may only search and fetch the topic's official documentation
//    domains (allowed_domains on the server-side web tools).
// 2. It returns the path through a strict tool, so the shape is guaranteed.
// 3. Every source it cites is checked against the pages it actually searched
//    or opened. Unverified sources are flagged to the reviewer and never shown
//    publicly; steps without a verified source are flagged too.
// 4. Nothing is public until an admin approves the draft.
const semver = require('semver');
const { z } = require('zod');
const LearningPath = require('../models/LearningPath');
const claude = require('./claude');

const MAX_CONTINUATIONS = 6;
const STEP_RANGE = [5, 12];

const SUBMIT_TOOL = {
  name: 'submit_learning_path',
  description:
    'Submit the finished learning path. Call this exactly once, after researching, with every step citing the official documentation pages you used.',
  strict: true,
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['intro', 'assumedKnowledge', 'steps'],
    properties: {
      intro: {
        type: 'string',
        description: 'Two or three sentences: who this path is for and what they will be able to do at the end.',
      },
      assumedKnowledge: {
        type: 'array',
        items: { type: 'string' },
        description: 'Skills a learner needs before step 1, e.g. "JavaScript basics". Empty if none.',
      },
      steps: {
        type: 'array',
        description: 'Ordered steps, from first to last.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'goal', 'explanation', 'prerequisites', 'estimatedHours', 'versionNote', 'sources'],
          properties: {
            title: { type: 'string', description: 'Short step title.' },
            goal: { type: 'string', description: 'One sentence: what the learner can do after this step.' },
            explanation: {
              type: 'string',
              description: '2-4 sentences on what to learn and why it matters, accurate for the current version.',
            },
            prerequisites: {
              type: 'array',
              items: { type: 'integer' },
              description: 'Numbers (1-based) of earlier steps this one builds on.',
            },
            estimatedHours: { type: 'number', description: 'Rough hours for a beginner.' },
            versionNote: {
              type: 'string',
              description:
                'If this area changed in a recent major version, say what changed so learners avoid outdated tutorials. Empty string otherwise.',
            },
            sources: {
              type: 'array',
              description: '1-3 official documentation pages you actually opened or saw in search results.',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['url', 'title'],
                properties: { url: { type: 'string' }, title: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },
};

const submissionSchema = z.object({
  intro: z.string().min(1),
  assumedKnowledge: z.array(z.string()),
  steps: z
    .array(
      z.object({
        title: z.string().min(1),
        goal: z.string().min(1),
        explanation: z.string(),
        prerequisites: z.array(z.number().int()),
        estimatedHours: z.number(),
        versionNote: z.string(),
        sources: z.array(z.object({ url: z.string(), title: z.string() })),
      })
    )
    .min(1),
});

const SYSTEM = `You design learning paths for Evergreen, a site that teaches software skills as they are today, not as they were when most tutorials were written.

Accuracy matters more than coverage. Learners will follow this path step by step, and an editor will check every claim against the sources you cite.

How to work:
- Research the topic's current official documentation with the web tools before writing. You can only reach the official documentation sites, which is intentional.
- Base every step on what the docs say for the current version. If something works differently than in older versions (renamed APIs, new defaults, removed features), say so in that step's versionNote.
- Order steps so each builds on earlier ones, from first install to the skills someone needs to build real projects. Aim for 6 to 10 steps.
- Cite 1 to 3 documentation pages per step, using URLs exactly as they appeared in your search results or fetched pages. Never construct or guess a URL.
- If the docs don't cover something you'd like to include, leave it out rather than relying on memory.

When you're done, call submit_learning_path once with the full path.`;

function hostname(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^utm_/i.test(key)) u.searchParams.delete(key);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

const onAllowedDomain = (url, domains) => {
  const host = hostname(url);
  return Boolean(host) && domains.some((d) => host === d || host.endsWith(`.${d}`));
};

// Official documentation domains for a topic: explicit ones if an editor set
// them, otherwise the homepages of its packages from npm.
function docsDomainsFor(topic) {
  if (topic.docsDomains?.length) return topic.docsDomains;
  const homes = topic.packages
    .map((name) => topic.live?.packages?.find((p) => p.name === name)?.homepage)
    .map((h) => h && hostname(h))
    .filter((h) => h && h !== 'github.com' && h !== 'npmjs.com');
  return [...new Set(homes)];
}

// Every URL Claude actually saw: search results, fetched pages, citations,
// and links printed by the dynamic-filtering code that runs behind the tools.
function collectResearchedUrls(content, into) {
  for (const block of content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) if (r.type === 'web_search_result' && r.url) into.add(r.url);
    } else if (block.type === 'web_fetch_tool_result' && block.content?.type === 'web_fetch_result') {
      into.add(block.content.url);
    } else if (block.type === 'text' && Array.isArray(block.citations)) {
      for (const c of block.citations) if (c.url) into.add(c.url);
    } else if (block.type === 'bash_code_execution_tool_result' || block.type === 'code_execution_tool_result') {
      const stdout = block.content?.stdout ?? '';
      for (const m of stdout.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) into.add(m[0]);
    }
  }
}

function buildPrompt(topic, primary, domains) {
  const lines = [
    `Topic: ${topic.name}`,
    `npm packages: ${topic.packages.join(', ')}`,
    `Current version of ${topic.packages[0]}: ${primary?.version ?? 'unknown'}${
      primary?.publishedAt ? ` (released ${new Date(primary.publishedAt).toISOString().slice(0, 10)})` : ''
    }`,
  ];
  if (topic.summary) lines.push(`Editor's summary: ${topic.summary}`);
  lines.push(`Official documentation sites you can use: ${domains.join(', ')}`);
  lines.push('', `Create a learning path for ${topic.name} as it is in version ${primary?.version ?? 'current'}.`);
  return lines.join('\n');
}

// Validates what Claude submitted and attaches verification results.
function finalizeSubmission(submission, researched, domains) {
  const seen = new Set([...researched].map(normalizeUrl).filter(Boolean));
  const warnings = [];
  const [minSteps, maxSteps] = STEP_RANGE;
  if (submission.steps.length < minSteps || submission.steps.length > maxSteps) {
    warnings.push(`Path has ${submission.steps.length} steps (expected ${minSteps}-${maxSteps}).`);
  }

  const steps = submission.steps.map((step, idx) => {
    const n = idx + 1;
    const sources = step.sources.map((s) => ({
      url: s.url,
      title: s.title,
      verified: onAllowedDomain(s.url, domains) && seen.has(normalizeUrl(s.url)),
    }));
    if (!sources.some((s) => s.verified)) {
      warnings.push(`Step ${n} ("${step.title}") has no verified official source. Check it carefully.`);
    }
    for (const s of sources) {
      if (!s.verified) {
        warnings.push(
          onAllowedDomain(s.url, domains)
            ? `Step ${n}: ${s.url} could not be confirmed as a real page during research; it may not exist.`
            : `Step ${n}: ${s.url} is not on an official docs site (${domains.join(', ')}).`
        );
      }
    }
    const prerequisites = [...new Set(step.prerequisites)].filter((p) => p >= 1 && p < n);
    if (prerequisites.length !== new Set(step.prerequisites).size) {
      warnings.push(`Step ${n}: removed prerequisites that pointed to itself or later steps.`);
    }
    return {
      title: step.title.trim(),
      goal: step.goal.trim(),
      explanation: step.explanation.trim(),
      prerequisites,
      estimatedHours: step.estimatedHours > 0 && step.estimatedHours < 200 ? step.estimatedHours : null,
      versionNote: step.versionNote.trim(),
      sources,
    };
  });

  return { intro: submission.intro.trim(), assumedKnowledge: submission.assumedKnowledge, steps, warnings };
}

// Runs the research + drafting conversation. Returns the finished fields for
// the LearningPath document. Throws with a readable message on failure.
async function draftPath(topic) {
  const client = claude.getClient();
  if (!client) throw new Error('AI features are not configured (ANTHROPIC_API_KEY is missing).');

  const primary = topic.live?.packages?.find((p) => p.name === topic.packages[0]);
  const domains = docsDomainsFor(topic);
  if (domains.length === 0) throw new Error('No official documentation site is known for this topic. Add docs domains first.');

  const tools = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 8, allowed_domains: domains },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 12, allowed_domains: domains, max_content_tokens: 20000 },
    SUBMIT_TOOL,
  ];
  const messages = [{ role: 'user', content: buildPrompt(topic, primary, domains) }];
  const researched = new Set();
  const usage = { inputTokens: 0, outputTokens: 0, webSearches: 0, webFetches: 0 };
  const started = Date.now();
  let servedBy = null;
  let nudged = false;

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const message = await client.beta.messages
      .stream({
        model: claude.model(),
        max_tokens: 32000,
        system: SYSTEM,
        output_config: { effort: claude.effort() },
        tools,
        messages,
        ...claude.fallbackParams(),
      })
      .finalMessage();

    servedBy = message.model;
    usage.inputTokens += message.usage?.input_tokens ?? 0;
    usage.outputTokens += message.usage?.output_tokens ?? 0;
    usage.webSearches += message.usage?.server_tool_use?.web_search_requests ?? 0;
    usage.webFetches += message.usage?.server_tool_use?.web_fetch_requests ?? 0;
    collectResearchedUrls(message.content, researched);

    if (message.stop_reason === 'refusal') {
      throw new Error(`Claude declined to draft this path${message.stop_details?.category ? ` (${message.stop_details.category})` : ''}.`);
    }
    if (message.stop_reason === 'max_tokens') throw new Error('The draft ran out of room before it was finished.');

    const submit = message.content.find((b) => b.type === 'tool_use' && b.name === SUBMIT_TOOL.name);
    if (submit) {
      const parsed = submissionSchema.safeParse(submit.input);
      if (!parsed.success) throw new Error('Claude returned an incomplete path. Try generating again.');
      return {
        ...finalizeSubmission(parsed.data, researched, domains),
        allowedDomains: domains,
        researchedUrls: [...researched].slice(0, 200),
        basedOnVersion: primary?.version ?? null,
        basedOnMajor: semver.coerce(primary?.version)?.major ?? null,
        generation: {
          model: claude.model(),
          servedBy,
          effort: claude.effort(),
          ...usage,
          durationMs: Date.now() - started,
        },
      };
    }

    // Keep the full assistant content (including thinking and tool results)
    // so the server can resume exactly where it left off.
    messages.push({ role: 'assistant', content: message.content });
    if (message.stop_reason === 'pause_turn') continue;
    if (nudged) break;
    nudged = true;
    messages.push({ role: 'user', content: 'Please call submit_learning_path now with the finished path.' });
  }
  throw new Error('Claude finished without submitting a path. Try generating again.');
}

const GENERATING_TIMEOUT_MS = 15 * 60 * 1000;

// Starts a draft in the background and returns its document immediately.
async function startGeneration(topic, userId) {
  const running = await LearningPath.findOne({
    topic: topic._id,
    status: 'generating',
    createdAt: { $gt: new Date(Date.now() - GENERATING_TIMEOUT_MS) },
  });
  if (running) return { path: running, alreadyRunning: true };

  const path = await LearningPath.create({ topic: topic._id, status: 'generating', requestedBy: userId });
  const job = draftPath(topic)
    .then((fields) => LearningPath.updateOne({ _id: path._id }, { $set: { ...fields, status: 'draft' } }))
    .catch((err) => {
      if (process.env.NODE_ENV !== 'test') console.error(`[paths] ${topic.slug}:`, err.message);
      return LearningPath.updateOne({ _id: path._id }, { $set: { status: 'failed', error: err.message } });
    });
  return { path, alreadyRunning: false, job };
}

module.exports = {
  startGeneration,
  draftPath,
  finalizeSubmission,
  collectResearchedUrls,
  docsDomainsFor,
  SUBMIT_TOOL,
};
