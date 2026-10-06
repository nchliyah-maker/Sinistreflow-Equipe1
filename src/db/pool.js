const { Pool, types } = require('pg');
const config = require('../config');

// Par défaut pg renvoie les BIGINT sous forme de texte. Nos montants en centimes
// tiennent largement dans un entier JavaScript : on les lit comme des nombres.
types.setTypeParser(types.builtins.INT8, (value) => parseInt(value, 10));

const pool = new Pool(config.db);

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
