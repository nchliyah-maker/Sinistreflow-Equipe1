require('dotenv').config();

// pas de valeur par défaut pour les secrets : ils viennent de l'environnement
const REQUIRED = ['DB_PASSWORD', 'BACKOFFICE_USER', 'BACKOFFICE_PASSWORD'];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(
    `Configuration incomplète, variable(s) manquante(s) : ${missing.join(', ')}. `
    + 'Copiez .env.example vers .env et renseignez les valeurs.',
  );
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  // 0.0.0.0 : joignable depuis l'extérieur du conteneur
  host: process.env.HOST || '0.0.0.0',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'sinistreflow',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'sinistreflow',
  },
  backoffice: {
    user: process.env.BACKOFFICE_USER,
    password: process.env.BACKOFFICE_PASSWORD,
  },
};
