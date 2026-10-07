const { Pool } = require('pg');
const config = require('../../src/config');
const db = require('../../src/db/pool');
const { migrate, listMigrations } = require('../../src/db/migrate');

const EMPTY_DATABASE = 'sinistreflow_migrations_test';

// Créer une base puis jouer 10 migrations peut dépasser les 5 s par défaut sur une machine chargée
jest.setTimeout(30000);

describe('SF-203 : migrations sur une base neuve', () => {
  let emptyDb;

  beforeAll(async () => {
    await db.query(`DROP DATABASE IF EXISTS ${EMPTY_DATABASE}`);
    await db.query(`CREATE DATABASE ${EMPTY_DATABASE}`);
    emptyDb = new Pool({ ...config.db, database: EMPTY_DATABASE });
  });

  afterAll(async () => {
    await emptyDb.end();
    await db.query(`DROP DATABASE IF EXISTS ${EMPTY_DATABASE}`);
    await db.pool.end();
  });

  test('les fichiers sont triés par numéro de version, pas par ordre alphabétique', () => {
    const versions = listMigrations().map((file) => parseInt(file.split('_')[0], 10));

    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('toutes les migrations s\'appliquent sur une base vide', async () => {
    await migrate(emptyDb);

    const { rows } = await emptyDb.query('SELECT version FROM schema_migrations ORDER BY applied_at, version');
    expect(rows.map((row) => row.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('la base neuve a bien les tables attendues', async () => {
    const { rows } = await emptyDb.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );

    expect(rows.map((row) => row.table_name)).toEqual([
      'claim_status_history', 'claims', 'contracts', 'expertises',
      'partners', 'policyholders', 'schema_migrations', 'vehicles',
    ]);
  });

  test('rejouer les migrations ne fait rien de plus', async () => {
    await migrate(emptyDb);

    const { rows } = await emptyDb.query('SELECT count(*) AS n FROM schema_migrations');
    expect(rows[0].n).toBe(10);
  });
});
