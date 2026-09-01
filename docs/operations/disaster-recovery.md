# Disaster recovery and restore acceptance

This runbook proves that an Atlas backup can become a usable Kurasikapa
database. Backup-enabled is not recovery-tested: the release gate is a restored,
isolated database that passes the verifier and the editorial smoke journey.

## Provisional launch objectives

- **RPO:** 15 minutes. Atlas continuous backup and point-in-time restore must be
  enabled on the production cluster. The client must approve this target and
  its storage cost before launch.
- **RTO:** 4 hours from incident declaration to a verified replacement
  database and redeployed API. The first timed drill supplies the evidence for
  accepting or revising this target.
- **Drill frequency:** before launch, after any data-model migration, and at
  least quarterly thereafter.
- **Owners:** incident commander authorises recovery; database owner performs
  the Atlas restore; technical lead verifies and cuts over; editor-in-chief
  accepts the publishing smoke test.

## Safety boundary

Restore into a new Atlas project or isolated temporary cluster/database. Never
restore over production. Use a read-only database user for verification. Keep
production `MONGODB_URI` available only for the command's fail-closed target
comparison; the verifier refuses an identical URI and database pair.

The verifier does not create collections, indexes or documents. It checks the
core editorial and identity collections, required correctness/query indexes,
inventory counts, category references and approved-revision references. Its
JSON output contains no connection string.

## Drill procedure

1. Record incident/drill ID, backup timestamp, requested recovery point,
   operator and start time in the incident record.
2. In Atlas, restore the selected snapshot or point in time to an isolated
   target. Apply an IP allowlist limited to the operator or CI runner and create
   a temporary read-only verifier user.
3. Run the acceptance command from `services/api`:

   ```sh
   DRILL_MONGODB_URI='mongodb+srv://read-only-user:REDACTED@restore.example/' \
   DRILL_MONGODB_DB='kurasikapa_restore_YYYYMMDD' \
   go run ./cmd/verify-restore > restore-evidence.json
   ```

   A healthy restore exits zero and reports `"healthy": true`. Missing
   collections/indexes, empty editorial/user inventory, dangling categories or
   missing approved revisions exit non-zero and list exact issues.
4. Point a temporary API deployment at the restored target. Verify `/healthz`,
   sign-in, Studio article listing, one published article, its media metadata,
   the review queue and the audit log. Do not send email, push, social posts,
   payment webhooks or live-video commands from this environment.
5. If this is a real incident, obtain incident-commander approval before
   changing any production environment variable. Redeploy API, Web and Studio,
   then run draft → review → approve → publish and public-read smoke tests.
6. Record restore completion, verifier JSON, application smoke evidence,
   achieved RPO/RTO, data exceptions and decision owner. Rotate the temporary
   credential and remove the isolated target through Atlas after evidence
   retention is confirmed.

## Failure handling

- Missing correctness indexes: do not cut over. Investigate whether the backup
  omitted metadata or the selected recovery point predates the migration.
- Dangling categories or approved revisions: treat as data corruption and
  choose an earlier recovery point unless the incident commander approves a
  separately reviewed repair.
- Empty inventory: confirm the database name and recovery point; never accept
  an empty database because `/healthz` alone is green.
- Provider restore exceeds four hours: record the actual RTO, escalate to Atlas
  support and revise capacity/runbook assumptions before launch acceptance.

## Evidence still required for production sign-off

- Atlas backup policy and PITR screenshots or exported configuration.
- One timed restore from the real production backup into an isolated target.
- Healthy verifier JSON retained with the incident/drill record.
- Authenticated Studio and public publishing smoke evidence against the restore.
- Named owners, approved RPO/RTO and a scheduled next drill.
