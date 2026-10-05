require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'sinistreflow',
    // fallback pour que ça marche direct en local
    password: process.env.DB_PASSWORD || 'Mutu@lp2021!',
    database: process.env.DB_NAME || 'sinistreflow',
  },
  backoffice: {
    user: process.env.BACKOFFICE_USER || 'gestionnaire',
    password: process.env.BACKOFFICE_PASSWORD || 'MutuAlp-BO-2024',
  },
};
