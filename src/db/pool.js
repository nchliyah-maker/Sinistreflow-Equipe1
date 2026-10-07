const { Pool, types } = require('pg');
const config = require('../config');
const logger = require('../logger');

// pg renvoie les BIGINT en texte : on les lit comme des nombres
types.setTypeParser(types.builtins.INT8, (value) => parseInt(value, 10));

const pool = new Pool(config.db);

// sans écouteur, une connexion PostgreSQL perdue arrête le processus Node.js
pool.on('error', (err) => {
  logger.error('connexion PostgreSQL perdue', { err });
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
