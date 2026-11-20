const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(date) {
  if (!date) return '';
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const STATUS_LABEL = {
  fresh: 'Fresh',
  aging: 'Aging',
  stale: 'Stale',
  untracked: 'Untracked',
  unknown: 'Unknown',
};

export const plural = (n, word, many = /(s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`) =>
  `${n} ${n === 1 ? word : many}`;

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const compactNumber = (n) => (n == null ? '-' : compact.format(n));

// Readable link to a post (falls back to the id for posts without a slug).
export const postPath = (post, suffix = '') => `/posts/${post?.slug || post?._id}${suffix}`;
