# Production preview inventory

The production preview is seeded through a Render one-off job, never through a
public HTTP route and never from an operator laptop. The job inherits the API
service's latest successful image plus its `MONGODB_URI` and `MONGODB_DB`, then
Render deprovisions it when the command exits.

This command is for a client demonstration, not launch journalism. It creates
three managed pages, three explicitly labelled preview presenters, three
programmes and three upcoming schedule slots. It does not fabricate journalist
profiles, article photography, licensed media or commercial terms.

## Safety contract

- The binary accepts only `seed` or `clear`.
- Both actions require the exact confirmation token
  `kurasikapa-client-preview-v1`.
- Every written record carries that tag.
- A matching record without the tag belongs to an operator and is not changed.
- Clear deletes tagged records only from `site_pages`, `presenters`,
  `programmes` and `schedule_slots`.
- The binary prints counts but never a URI, credential or document body.
- The normal image command remains `/api`; `/preview-inventory` runs only when
  an operator creates a one-off job explicitly.

## Seed

Use the API service ID from Render. The current service is
`srv-daa6qvh42hec739n0gkg`.

```sh
render jobs create srv-daa6qvh42hec739n0gkg \
  --start-command '/preview-inventory seed --confirm=kurasikapa-client-preview-v1' \
  --plan-id plan-srv-006 \
  --confirm \
  --output json
```

Record the returned job ID, then wait for terminal status:

```sh
render jobs list srv-daa6qvh42hec739n0gkg --output json
```

Acceptance evidence is all of the following:

1. The job status is `succeeded`.
2. Its log contains `seeded 12 managed preview records`, or a lower number only
   when a documented operator-owned page was preserved.
3. Public API reads return three presenters, three programmes and three
   upcoming slots.
4. Web `/en/live` returns HTTP 200 and shows the programme inventory.
5. No preview presenter is presented as a verified journalist or team member.

## Clear

Create another one-off job with the matching guarded command:

```sh
render jobs create srv-daa6qvh42hec739n0gkg \
  --start-command '/preview-inventory clear --confirm=kurasikapa-client-preview-v1' \
  --plan-id plan-srv-006 \
  --confirm \
  --output json
```

Require `succeeded`, record the removed count and verify the four public
collections return no tagged preview inventory. Operator-owned records remain.
Do not clear the preview immediately before a client demonstration unless the
real replacement inventory has already been approved and published.

## Failure and rollback

- A missing environment variable, bad confirmation token or database error
  exits non-zero and leaves the public API process untouched.
- If a seed job fails after partial progress, rerun the same seed command. It is
  idempotent for preview-owned identifiers.
- If the image itself is unhealthy, roll the API service back to the preceding
  successful Render deployment. The one-off job never replaces the running
  service instance.
- If preview content must be removed, run the guarded clear job; do not issue a
  broad MongoDB deletion.

Render documents that one-off jobs reuse the base service's build artifact and
environment, are billed only while running and terminate when their command
exits: <https://render.com/docs/one-off-jobs>.
