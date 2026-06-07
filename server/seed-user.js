const { Pool } = require('pg');

const db_url = 'postgresql://postgres:HFAornGsqDeSdZbXAyAIedVCAHpPatQl@postgres.railway.internal:5432/railway';

const pool = new Pool({ connectionString: db_url });

pool.query(
  `INSERT INTO users (name, email, password_hash, role)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (email) DO NOTHING
   RETURNING *`,
  ['Admin', 'admin@tracker.com', '$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/tjO', 'admin']
)
  .then(res => {
    console.log(res.rows.length ? '✓ User created' : '✓ User exists');
    pool.end();
  })
  .catch(err => {
    console.error('✗ Error:', err.message);
    pool.end();
    process.exit(1);
  });
