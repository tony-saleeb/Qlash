#!/usr/bin/env bash
# Apply the schema files in the new-project order against the local Supabase database.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
container="${1:?database container name, for example supabase_db_qlash}"
files=(
  schema.sql
  schema-p2-migration.sql
  schema-p2b-capacity.sql
  schema-fast-submit.sql
  schema-p3-live-hardening.sql
  schema-p4-ops.sql
  schema-media.sql
  schema-p5-classroom.sql
  schema-p6-locale.sql
  schema-p7-share.sql
  schema-p8-rls.sql
  schema-p9-live.sql
  schema-p10-late-grading.sql
  schema-p11-fast-lobby.sql
  schema-p12-hardening.sql
  schema-p13-live-rpcs.sql
  schema-p14-realtime-auth.sql
  schema-p15-anon-lockdown.sql
  schema-p16-keep-history.sql
  schema-p17-clock-and-reveal.sql
  schema-p18-double-points.sql
  schema-p19-question-rules.sql
  schema-p20-answer-selection.sql
  schema-p21-pause-submit.sql
  schema-p22-projector-clock.sql
  schema-p23-room-lock.sql
  schema-p24-import-once.sql
  schema-p25-rate-limit-keys.sql
  schema-p26-stale-rooms.sql
)
for file in "${files[@]}"; do
  echo "apply ${file}"
  docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "${root}/${file}"
done
