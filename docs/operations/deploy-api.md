# Deploy the Go API

This is the smallest path to a live `API_URL`. The web app already calls
`services/api` for every CMS write/read and public read when `API_URL` is set;
unset `API_URL` keeps the TypeScript path.

## 1. Deploy to Render

1. In Render, choose **New → Blueprint** and point it at this repo. It will
   read [`render.yaml`](../../render.yaml).
2. The blueprint creates one Docker web service (`kurasikapa-media-api`) from
   `services/api/Dockerfile`. Health check: `GET /healthz`.
3. In the service's **Environment** tab, set:
   - `MONGODB_URI` — Atlas connection string (replica set).
   - `MONGODB_DB` — `kurasikapa` (default; only override for a different DB).
   - `CRON_SECRET` — a random bearer token for the cron guard. Leave unset to
     refuse every scheduled request.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and
     `CLOUDINARY_API_SECRET` — required for verified media uploads and for
     promoting narration and recorded-live output.
   - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` — credentials for a
     least-privilege API workload principal. Do not use AWS root credentials.
   - `AWS_POLLY_REGION` and `AWS_POLLY_OUTPUT_BUCKET` — narration region and
     private staging bucket.
   - `AWS_IVS_REGION`, `AWS_IVS_RECORDING_BUCKET`,
     `AWS_MEDIACONVERT_OUTPUT_BUCKET`, `AWS_MEDIACONVERT_ROLE_ARN`,
     `AWS_MEDIACONVERT_JOB_TEMPLATE` and `IVS_RECORDING_WEBHOOK_SECRET` —
     recorded-live intake and promotion. Configure this complete group; a
     partial group cannot deliver a replay candidate.
   - `PAYSTACK_SECRET_KEY`, `STRIPE_SECRET_KEY` and
     `STRIPE_WEBHOOK_SECRET` — live payment credentials, only after provider
     approval and webhook registration.
   - `VOYAGE_API_KEY` — Voyage embedding key, enabled only after the Atlas
     vector index below reports `READY`.
   - `VOYAGE_MODEL` — optional; defaults to `voyage-4`.
   - `VOYAGE_DIMENSIONS` — optional; defaults to `1024` and must match Atlas.
   - `PORT` — do not set this manually. Render injects the port that its edge
     proxy routes to, and the API reads it at startup.
4. Deploy. Wait for the health check to pass. At startup the API creates the
   Mongo indexes it depends on (`articles`, `categories`, `article_revisions`)
   and refuses to serve if the unique ones cannot be built — a first deploy
    against an empty Atlas database is self-provisioning.

The Blueprint declares every one of these keys so a fresh service exposes the
full contract in Render. Keys marked `sync: false` still require an operator to
enter their values; the declaration does not create or copy a credential.

### Create the semantic vector index

Create an Atlas Vector Search index named `article_semantic_vector` on the
`article_semantic_documents` collection with a 1,024-dimension cosine vector
field at `embedding`, plus filter fields for `locale` and `active`. The exact
definition is recorded in [ADR-0015](../decisions/adr-0015-manual-semantic-embeddings.md).
Wait for Atlas to report `READY`, then add `VOYAGE_API_KEY` and redeploy. Until
both are ready, public search and recommendations continue through their
lexical and same-section fallbacks.

## 2. Point the web app at it

In Vercel, set `API_URL` to the Render service URL (e.g.
`https://kurasikapa-media-api.onrender.com`) and redeploy. No code change is needed.

## 3. Smoke-check the cut-over

Run [`scripts/smoke-api.sh`](../../scripts/smoke-api.sh), which checks:

- `GET $API_URL/healthz` → `200`
- `POST $API_URL/articles` without a session → `403`
- `POST $API_URL/internal/publish-due` with the wrong secret → `404` (the
  protected route is deliberately hidden).
- `POST $API_URL/internal/publish-due` with the right secret → `200` (skipped
  unless `CRON_SECRET` is set).

```sh
API_URL=https://kurasikapa-media-api.onrender.com CRON_SECRET=... scripts/smoke-api.sh
```

Then, in the studio, create a draft, submit it, approve it, publish it, and
load the public article page. All should come from the Go service.

If any step fails, unset `API_URL` to fall back to the TypeScript path, fix,
and try again.

## 4. Scheduled Studio work

The Vercel Hobby plan only permits daily cron jobs, which is too slow for
scheduled news publication. [studio-cron.yml](../../.github/workflows/studio-cron.yml)
runs the protected Studio endpoints instead: publication and social delivery
every five minutes, and RSS ingestion hourly. Add `CRON_SECRET` as a GitHub
Actions repository secret with the same value configured in Studio and Render.
The workflow also supports a manual run for deployment verification. Social
delivery remains skipped until Meta credentials are approved and the GitHub
repository variable `ENABLE_SOCIAL_CRON` is set to `true`.
The five-minute publication job also calls `process-semantic-index`; this
backfills any missed published revision and processes the pending embedding
queue with bounded retries.

## 5. Delete the TypeScript editorial packages

Only after the smoke-check above is green and the Go API is the only live
path, remove:

- `packages/domain/src/editorial/`
- `packages/application/src/editorial/`
- `packages/adapter-mongo/src/mongo-article-repository.ts`,
  `mongo-revision-repository.ts`, `mongo-category-repository.ts`

Keep the identity/audience/distribution TS packages until their Go contexts
are ported.
