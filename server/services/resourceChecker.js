// Automatic checks run on every community-submitted resource before a human
// reviews it. They can't prove a page is *correct*, but they reliably catch the
// common problems: dead links, pages that aren't about the topic, duplicates,
// and tutorials written for an old major version.
const semver = require('semver');
const { safeFetchPage } = require('./safeFetch');

let fetchPage = safeFetchPage;

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");

function extractText(html) {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim());
  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
  return { title: title.slice(0, 200), text };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Bare names of scoped packages that say nothing about the topic on their own.
const GENERIC = new Set(['sdk', 'core', 'client', 'cli', 'api', 'node', 'js', 'test', 'utils', 'server', 'react', 'vue']);

// Words that identify the topic: its name, extra keywords, and its packages.
// For scoped packages ("@tanstack/react-query") the bare name ("react-query")
// counts too, unless it's generic ("@anthropic-ai/sdk" -> "sdk").
function topicTerms(topic) {
  const terms = new Set([topic.name.toLowerCase(), ...(topic.keywords ?? []).map((k) => k.toLowerCase())]);
  for (const pkg of topic.packages) {
    terms.add(pkg);
    const bare = pkg.startsWith('@') ? pkg.split('/')[1] : null;
    if (bare && !GENERIC.has(bare)) terms.add(bare);
  }
  return [...terms].filter((t) => t.length >= 2);
}

function relevance(topic, { title, text }) {
  const matched = [];
  let mentions = 0;
  for (const term of topicTerms(topic)) {
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}(?![a-z0-9])`, 'gi');
    const inTitle = re.test(title);
    re.lastIndex = 0;
    const count = (text.match(re) || []).length;
    if (inTitle || count) matched.push(term);
    mentions += count + (inTitle ? 3 : 0);
  }
  // In the title, or mentioned repeatedly in the body.
  return { relevant: mentions >= 3, matched, mentions };
}

// Finds which major versions of the primary package the page talks about:
// "react@18", "react 18.2", "React v19", "next@^14".
function versionsMentioned(topic, text) {
  const pkg = topic.packages[0];
  const names = [...new Set([pkg, pkg.split('/').pop(), topic.name])].map(escapeRegex).join('|');
  const re = new RegExp(`(?:^|[^a-z0-9])(?:${names})(?:@[\\^~]?|\\s+v?|\\s+version\\s+)(\\d{1,3})(?:\\.\\d+){0,2}(?![\\d])`, 'gi');
  const majors = new Set();
  for (const m of text.matchAll(re)) majors.add(Number(m[1]));
  return [...majors].sort((a, b) => a - b);
}

function versionVerdict(majors, latestVersion) {
  const latest = semver.coerce(latestVersion)?.major;
  if (latest == null) return { status: 'unknown', latestMajor: null, mentionedMajor: null };
  // Ignore numbers that can't be versions of this package (e.g. "React 2024").
  const plausible = majors.filter((m) => m <= latest + 1);
  if (plausible.length === 0) return { status: 'unknown', latestMajor: latest, mentionedMajor: null };
  const newest = Math.max(...plausible);
  return {
    status: newest >= latest ? 'current' : 'outdated',
    latestMajor: latest,
    mentionedMajor: newest,
  };
}

async function checkResource(topic, url, latestVersion) {
  const page = await fetchPage(url);
  const checks = {
    checkedAt: new Date(),
    reachable: page.ok,
    httpStatus: page.status ?? null,
    finalUrl: page.finalUrl,
    pageTitle: '',
    relevant: false,
    matchedTerms: [],
    mentions: 0,
    version: { status: 'unknown', latestMajor: null, mentionedMajor: null },
  };
  if (!page.ok) return checks;

  const extracted = /html/i.test(page.contentType || '') ? extractText(page.body) : { title: '', text: page.body };
  const rel = relevance(topic, extracted);
  checks.pageTitle = extracted.title;
  checks.relevant = rel.relevant;
  checks.matchedTerms = rel.matched;
  checks.mentions = rel.mentions;
  checks.version = versionVerdict(versionsMentioned(topic, `${extracted.title} ${extracted.text}`), latestVersion);
  return checks;
}

const setPageFetcher = (fn) => {
  fetchPage = fn;
};
const resetPageFetcher = () => {
  fetchPage = safeFetchPage;
};

module.exports = {
  checkResource,
  topicTerms,
  extractText,
  relevance,
  versionsMentioned,
  versionVerdict,
  setPageFetcher,
  resetPageFetcher,
};
