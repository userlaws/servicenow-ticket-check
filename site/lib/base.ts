// GitHub Pages serves the site from /<repo-name>, so links to our own pages
// and files need that prefix. It's set at build time and empty locally.
export const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
