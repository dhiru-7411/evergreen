// The knowledge areas Evergreen covers. Deliberately narrow: core skills for
// building software, where "what's the latest version and what are the
// alternatives" really matters. Every topic must belong to one of these.
const CATEGORIES = [
  { id: 'frontend', name: 'Frontend', blurb: 'UI libraries and frameworks for the browser' },
  { id: 'backend', name: 'Backend & APIs', blurb: 'Servers, APIs and runtimes' },
  { id: 'fullstack', name: 'Full-stack frameworks', blurb: 'Frameworks that cover client and server' },
  { id: 'databases', name: 'Databases & ORMs', blurb: 'Storing and querying data' },
  { id: 'tooling', name: 'Languages & tooling', blurb: 'TypeScript, bundlers and build tools' },
  { id: 'testing', name: 'Testing', blurb: 'Unit, integration and end-to-end testing' },
  { id: 'mobile', name: 'Mobile', blurb: 'Building iOS and Android apps with JavaScript' },
  { id: 'ai', name: 'AI & LLM apps', blurb: 'SDKs and frameworks for building with AI models' },
];

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

module.exports = { CATEGORIES, CATEGORY_IDS };
