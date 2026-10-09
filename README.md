# Thoughtful Gifting

Pick who it's for and the occasion, add what they love, get gift ideas you can actually buy.

- `/` – the gift finder. AI ideas, with products added in the admin blended in when they fit, and up to two "Sponsored" cards per search.
- `/manage` – private admin, locked by `ADMIN_PASSWORD`. Paste a product link and it fills in the details; manage the 5 ad slots.

Answers are cached by Vercel's CDN for 12 hours per unique search, so repeat searches don't call Claude again.

## Setup on Vercel
1. Storage → create a **Blob** store (Public access) and connect it to this project.
2. Environment variables: `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD` (12+ characters). Redeploy after adding them.
