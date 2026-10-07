const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

const migrationVersion = (file) => parseInt(file.split('_')[0], 10);

/** Liste les fichiers de migration dans l'ordre où ils doivent être joués. */
function listMigrations(dir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    // tri numérique : en ordre alphabétique, "10_..." passerait avant "2_..."
    .sort((a, b) => migrationVersion(a) - migrationVersion(b));
}

async function migrate(db = pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await db.query('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.version));

  for (const file of listMigrations()) {
    const version = migrationVersion(file);
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`→ migration ${file}`);

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [version, file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`${file} : ${err.message}`);
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migrations OK');
      return pool.end();
    })
    .catch((err) => {
      console.error('Migration échouée :', err.message);
      process.exit(1);
    });
}

module.exports = { migrate, listMigrations };
