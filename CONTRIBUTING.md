# Mathematics Archive Setup

The archive reads published Mathematics resources from `study_hub_resources` in the Study Hub Supabase project. Community uploads are stored in a separate private bucket and remain pending until a curator reviews them.

## Work on the Astro archive

The archive page source is `src/pages/archive.html.astro`; the root `src/pages/index.astro` redirects to it. Do not edit generated files in `dist/` or recreate root-level `archive.html`/`index.html` files. Shared archive behavior and styles remain in `archive.js` and `archive.css`.

Install dependencies with `npm install`, run a local preview with `npm run dev`, and build the deployable site with `npm run build`. The build writes the published pages to `dist/`, including `dist/archive.html`.

## Configure the public archive

Edit `supabase-config.js` with the project's public Supabase URL and anon/publishable key, the deployed `submit-math-resource` function URL, and a Cloudflare Turnstile site key. These are public browser values; never put a service-role key in this file.

For local preview, use a Turnstile test site key configured for `localhost`.

## Deploy the secure intake

From the Study Hub repository, apply migration `20261001090000_study_hub_math_submissions.sql` to the shared Supabase project. Deploy `submit-math-resource` and configure these Edge Function secrets:

- `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile secret for the archive hostname.
- `SUBMISSION_RATE_LIMIT_SALT`: a random secret used to hash contributor IPs before rate-limit storage.
- `MATH_ARCHIVE_ALLOWED_ORIGINS`: comma-separated exact origins, such as `https://trustjonathan.github.io,http://127.0.0.1:5500`.

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the deployed function. Do not copy either service-role secret into the static site.

## Review contributions

Uploads land under `pending/` in the private `math-resource-submissions` bucket. Their metadata is recorded in `study_hub_math_submissions` with `status = 'pending'`; neither anon nor authenticated browser clients can read the rows or objects. The submission form does not publish resources automatically.

A curator should inspect the file, reject it or copy an approved file into `study-hub-resources` under `documents/math/notes/` or `documents/math/papers/`, then insert its metadata into `study_hub_resources` and mark the submission reviewed. The public archive only displays rows in that public catalog.

The review console/workflow is not implemented yet; use the Supabase dashboard with an authorized project role until one is added.