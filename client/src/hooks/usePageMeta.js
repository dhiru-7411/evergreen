import { useEffect } from 'react';

const SITE = 'Evergreen';
const DEFAULT_TITLE = "Evergreen: learn what's current";
const DEFAULT_DESCRIPTION =
  'Live versions, the alternatives worth knowing, and step-by-step learning paths built from official docs, with every fact cited.';

// Sets the browser-tab title and meta description for the current page.
// (Link-preview bots get server-rendered tags from /api/og instead.)
export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : DEFAULT_TITLE;
    const tag = document.querySelector('meta[name="description"]');
    if (tag) tag.setAttribute('content', description || DEFAULT_DESCRIPTION);
  }, [title, description]);
}
