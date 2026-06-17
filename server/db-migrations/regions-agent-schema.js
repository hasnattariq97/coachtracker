async function migrateRegionsAgentSchema(queryFn) {
  // Add region_id to monitoring_snapshots (tracks which region the snapshot belongs to)
  await queryFn(`ALTER TABLE monitoring_snapshots ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id)`);

  // Add region_id to daily_reports (nullable — NULL = combined super_admin report, integer = per-region)
  await queryFn(`ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id)`);
}

module.exports = { migrateRegionsAgentSchema };
