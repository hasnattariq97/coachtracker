async function migrateRegionsAgentSchema(queryFn) {
  // Add region_id to monitoring_snapshots (tracks which region the snapshot belongs to)
  await queryFn(`ALTER TABLE monitoring_snapshots ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id)`);

  // Add region_id to daily_reports (nullable — NULL = combined super_admin report, integer = per-region)
  await queryFn(`ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id)`);

  // Unique per (date, region) — handles NULL region_id with a conditional index.
  // COALESCE(region_id, 0) maps NULL to 0 so the combined super_admin report (region_id = NULL)
  // can coexist with per-region reports on the same date without colliding with each other.
  await queryFn(`
    CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_date_region_unique
    ON daily_reports (report_date, COALESCE(region_id, 0))
  `);
}

module.exports = { migrateRegionsAgentSchema };
