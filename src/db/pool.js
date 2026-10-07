const { Pool, types } = require('pg');
const config = require('../config');
const logger = require('../logger');

// Par défaut pg renvoie les BIGINT sous forme de texte. Nos montants en centimes
// tiennent largement dans un entier JavaScript : on les lit comme des nombres.
types.setTypeParser(types.builtins.INT8, (value) => parseInt(value, 10));

const pool = new Pool(config.db);

// Quand PostgreSQL s'arrête, le pool émet "error" sur ses connexions au repos. Sans écouteur,
// Node.js arrête le processus : l'application tombait avec la base au lieu de répondre 503.
// On journalise ; le pool rouvrira des connexions quand la base sera revenue.
pool.on('error', (err) => {
  logger.error('connexion PostgreSQL perdue', { err });
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
