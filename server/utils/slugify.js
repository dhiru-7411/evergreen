// Turns a name or title into a URL segment: "Next.js 16 & React" -> "nextjs-16-react".
const slugify = (text, maxLength = 60) =>
  String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents: café -> cafe
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/#/g, ' sharp ')
    .replace(/\./g, '') // Next.js -> nextjs
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');

const OBJECT_ID = /^[a-f0-9]{24}$/i;

module.exports = { slugify, OBJECT_ID };
