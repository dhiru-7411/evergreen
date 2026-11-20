// Imports hand-written learning paths (content/paths/<slug>.json) as drafts.
// No AI API is involved, so this costs nothing. Every source link is opened:
// it counts as verified only if the page loads and is on one of the topic's
// official docs domains. An admin then reviews and publishes the draft.
//
//   npm run import-path -- express          one topic
//   npm run import-path -- --all            every file in content/paths
require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const semver = require('semver');
const Topic = require('../models/Topic');
const User = require('../models/User');
const LearningPath = require('../models/LearningPath');
const { safeFetchPage } = require('../services/safeFetch');
const { extractText } = require('../services/resourceChecker');
const { finalizeSubmission, docsDomainsFor } = require('../services/learningPathService');

const DIR = path.join(__dirname, '..', 'content', 'paths');

const titleOf = (res) => (res.ok && /html/i.test(res.contentType || '') ? extractText(res.body).title : '');

// Some docs sites answer 200 with a generic page for URLs that don't exist
// ("soft 404"). Learn what that page looks like per host by requesting a
// deliberately fake URL, so a made-up link can't pass as verified.
const notFoundTitles = new Map();
async function softNotFoundTitle(url) {
  // Probe the same folder as the link: some sites 404 at the root but serve
  // a generic 200 page for anything under /docs/.
  const probe = new URL(`evergreen-link-check-${Date.now()}`, url);
  const dir = probe.href.slice(0, probe.href.lastIndexOf('/') + 1);
  if (!notFoundTitles.has(dir)) {
    const res = await safeFetchPage(probe.href).catch(() => ({ ok: false }));
    notFoundTitles.set(dir, res.ok ? titleOf(res) : null);
  }
  return notFoundTitles.get(dir);
}

async function importOne(slug, author) {
  const file = path.join(DIR, `${slug}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const topic = await Topic.findOne({ slug });
  if (!topic) throw new Error(`No topic "${slug}". Run npm run seed first.`);

  const domains = docsDomainsFor(topic);
  const urls = [...new Set(data.steps.flatMap((s) => s.sources.map((src) => src.url)))];
  const opened = new Set();
  for (const url of urls) {
    const res = await safeFetchPage(url).catch(() => ({ ok: false }));
    if (!res.ok) {
      console.log(`    ✗ could not open ${url}`);
      continue;
    }
    const fake = await softNotFoundTitle(url);
    if (fake !== null && titleOf(res) === fake) {
      console.log(`    ✗ ${url} looks like the site's "not found" page`);
      continue;
    }
    opened.add(url);
  }

  const fields = finalizeSubmission(data, opened, domains);
  const primary = topic.live?.packages?.find((p) => p.name === topic.packages[0]);
  const written = data.basedOnVersion ?? primary?.version ?? null;

  // Replace an earlier unreviewed import for this topic rather than piling up drafts.
  await LearningPath.deleteMany({ topic: topic._id, status: 'draft', 'generation.model': 'hand-written' });
  await LearningPath.create({
    ...fields,
    topic: topic._id,
    status: 'draft',
    allowedDomains: domains,
    researchedUrls: [...opened],
    basedOnVersion: written,
    basedOnMajor: semver.coerce(written)?.major ?? null,
    requestedBy: author?._id,
    generation: { model: 'hand-written', servedBy: 'Claude Code (research in chat)' },
  });

  const verified = fields.steps.flatMap((s) => s.sources).filter((s) => s.verified).length;
  const total = fields.steps.flatMap((s) => s.sources).length;
  console.log(`  ${slug.padEnd(20)} ${fields.steps.length} steps, ${verified}/${total} sources verified, ${fields.warnings.length} warnings`);
  for (const w of fields.warnings) console.log(`    ! ${w}`);
}

async function main() {
  const args = process.argv.slice(2);
  const slugs = args.includes('--all')
    ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
    : args;
  if (slugs.length === 0) {
    console.error('Usage: npm run import-path -- <slug> [...] | --all');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const author = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  for (const slug of slugs) await importOne(slug, author);
  console.log('\nDrafts are waiting in each topic page\'s admin panel for review.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
