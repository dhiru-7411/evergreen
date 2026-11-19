const { z } = require('zod');
const semver = require('semver');

// npm's naming rules, including scoped packages like @tanstack/react-query.
const PACKAGE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

const stackItem = z.object({
  name: z.string().trim().toLowerCase().max(214).regex(PACKAGE_NAME, 'Not a valid npm package name'),
  version: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .refine((v) => semver.coerce(v) !== null, 'Use a version like 18, 18.2 or ^18.2.0'),
});

const stack = z
  .array(stackItem)
  .max(12, 'Track at most 12 packages')
  .refine((items) => new Set(items.map((i) => i.name)).size === items.length, 'Duplicate package in stack');

const title = z.string().trim().min(3).max(160);
const content = z.string().trim().min(20, 'Write at least a couple of sentences').max(100_000);
const note = z.string().trim().min(3, 'Describe what changed').max(280);

const register = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, _ and - only'),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
});

const login = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

const createPost = z.object({ title, content, stack: stack.default([]) });

// Every edit is a revision, so it needs a note and the revision it was based on.
const updatePost = z
  .object({
    title: title.optional(),
    content: content.optional(),
    stack: stack.optional(),
    note,
    baseRevision: z.number().int().positive(),
  })
  .refine((b) => b.title || b.content || b.stack, 'Nothing to update');

const listPosts = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['fresh', 'aging', 'stale', 'untracked']).optional(),
  author: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid author id').optional(),
  q: z.string().trim().max(100).optional(),
});

const username = z.object({
  username: z.string().trim().min(1).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid username'),
});

const proposeFix = z.object({
  title,
  content,
  stack,
  note,
  baseRevision: z.number().int().positive(),
});

const listFixes = z.object({
  status: z.enum(['open', 'merged', 'rejected']).optional(),
});

const mergeFix = z.object({
  force: z.boolean().default(false),
  reviewNote: z.string().trim().max(280).optional(),
});

const rejectFix = z.object({
  reviewNote: z.string().trim().max(280).optional(),
});

const packageName = z.string().trim().toLowerCase().max(214).regex(PACKAGE_NAME, 'Not a valid npm package name');

const createTopic = z.object({
  name: z.string().trim().min(2).max(60),
  summary: z.string().trim().max(400).default(''),
  packages: z
    .array(packageName)
    .min(1, 'Add at least one npm package')
    .max(5, 'At most 5 packages')
    .refine((p) => new Set(p).size === p.length, 'Duplicate package'),
  alternatives: z
    .array(z.object({ name: packageName, note: z.string().trim().max(200).default('') }))
    .max(8, 'At most 8 alternatives')
    .refine((a) => new Set(a.map((x) => x.name)).size === a.length, 'Duplicate alternative')
    .default([]),
});

const topicSlug = z.object({
  slug: z.string().trim().toLowerCase().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Invalid topic'),
});

module.exports = {
  createTopic,
  topicSlug,
  register,
  login,
  createPost,
  updatePost,
  listPosts,
  username,
  proposeFix,
  listFixes,
  mergeFix,
  rejectFix,
};
