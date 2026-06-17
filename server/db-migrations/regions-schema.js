async function migrateRegions(query) {
  // 1. Create regions table
  await query(`
    CREATE TABLE IF NOT EXISTS regions (
      id   SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );
  `);

  // 2. Seed the 6 fixed regions
  const regions = ['Urban-I', 'Urban-II', 'Barakahu', 'Tarnol', 'Nilore', 'Sihala'];
  for (const name of regions) {
    await query(`INSERT INTO regions (name) VALUES (?) ON CONFLICT (name) DO NOTHING`, [name]);
  }

  // 3. Drop old role CHECK constraint, add new one including super_admin
  await query(`
    DO $$ BEGIN
      ALTER TABLE users DROP CONSTRAINT users_role_check;
    EXCEPTION WHEN undefined_object THEN NULL; END $$;
  `);
  await query(`
    DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('super_admin', 'admin', 'coach'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // 4. Add region_id column to users (nullable — super_admin has no region)
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id);
  `);

  // 5. Migrate existing coaches → Urban-I
  await query(`
    UPDATE users SET region_id = (SELECT id FROM regions WHERE name = 'Urban-I')
    WHERE role = 'coach' AND region_id IS NULL;
  `);

  // 6. Migrate hasnat@niete.edu.pk → admin + Urban-I
  await query(`
    UPDATE users
    SET region_id = (SELECT id FROM regions WHERE name = 'Urban-I')
    WHERE email = 'hasnat@niete.edu.pk' AND region_id IS NULL;
  `);

  // 7. Seed super_admin and 5 new regional admin accounts
  const accounts = [
    { name: 'Super Admin',    email: 'hasnattariq97@gmail.com',     hash: '$2b$12$7VDe1Oev.TnJ4zo6P8xK0e2uBvxTRzYoKUduuXX4.JN8IONm8WwVi', role: 'super_admin', region: null      },
    { name: 'Hashir Hussain', email: 'hashir.hussain@niete.edu.pk', hash: '$2b$12$LqBjC/RiFSwPb9F5dtQ2OekDRgrXJ/TrktavmKjDMlD9nn1Ozma2O',  role: 'admin',       region: 'Sihala'   },
    { name: 'Anam Masood',   email: 'anam.masood@niete.edu.pk',    hash: '$2b$12$rKtROcZmqino4l4XnNhj1eZ3hD3IN45zJNLxFUcmPqcNMHAfqf80u',  role: 'admin',       region: 'Urban-II' },
    { name: 'Sara Fatima',   email: 'sara.fatima@niete.edu.pk',    hash: '$2b$12$/hGkSZjkvs7MvdttN7LQHOSkrTW/GYOl9k8HGAvchOqrsF6Ni1wAG',  role: 'admin',       region: 'Nilore'   },
    { name: 'Asma Zaheer',   email: 'asma.zaheer@niete.edu.pk',    hash: '$2b$12$MLEULG2NExZo6V6sfPikz.zx.ybugw87hHVct8hsp/daabcf2qdDS',   role: 'admin',       region: 'Barakahu' },
    { name: 'Abdul Waheed',  email: 'abdul.waheed@niete.edu.pk',   hash: '$2b$12$sl6ht4aOCyOK809EXIxvb.ADculqtCqHTZ56RVFYObqEfNNaaToBy',   role: 'admin',       region: 'Tarnol'   },
  ];

  for (const acct of accounts) {
    const existing = await query(`SELECT id FROM users WHERE email = ?`, [acct.email]);
    if (existing.rows.length > 0) continue;

    if (acct.region) {
      await query(`
        INSERT INTO users (name, email, password_hash, role, region_id)
        VALUES (?, ?, ?, ?, (SELECT id FROM regions WHERE name = ?))
      `, [acct.name, acct.email, acct.hash, acct.role, acct.region]);
    } else {
      await query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `, [acct.name, acct.email, acct.hash, acct.role]);
    }
  }

  console.log('✓ Regions migration complete');
}

module.exports = { migrateRegions };
