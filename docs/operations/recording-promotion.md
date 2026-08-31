# IVS recording promotion

## Provider setup

1. Keep the IVS source and MediaConvert output buckets private and in the same
   region as IVS. Apply a recovery lifecycle to original HLS and a short safety
   lifecycle to temporary MP4 output.
2. Create a MediaConvert service role that reads the IVS prefix and writes and
   deletes only the processing prefix. Create the HLS-to-MP4 job template named
   by `AWS_MEDIACONVERT_JOB_TEMPLATE`; its single file output must preserve the
   input basename as `master.mp4`.
3. Allowlist the processing bucket for Cloudinary with
   `.wellknown/cloudinary/<cloud-name>` and grant read-only access. Never
   allowlist the original IVS bucket.
4. Create an EventBridge rule for `aws.ivs`, `IVS Recording State Change`, and
   `Recording End`. Its API destination posts to `/webhooks/ivs/recordings`
   with `X-Kurasikapa-IVS-Secret` set to `IVS_RECORDING_WEBHOOK_SECRET`.
5. Put the same `CRON_SECRET` on GitHub, Studio and the API. The five-minute
   Studio schedule calls `/internal/process-recordings` through its BFF.

## Safety and recovery

- Intake accepts only the configured source bucket, an `ivs/v1/` prefix, one
  IVS channel ARN, a supported locale-prefixed channel name and positive
  duration. Invalid or unsigned events do not start paid work.
- `recording_session_id` is unique in MongoDB. Provider retries return the
  existing import; a failed start remains requested and can be retried.
- A completed transcode becomes a ready private media-library video. It remains
  off-air until an editor pairs it with ready WebVTT and publishes the replay.
- On failure, inspect `recording_imports.failureReason`, the MediaConvert job
  and processing object. Original IVS HLS remains recoverable until lifecycle
  expiry.
