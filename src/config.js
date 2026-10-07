require('dotenv').config();

// Les secrets n'ont volontairement aucune valeur par défaut dans le code :
// ils viennent de l'environnement (fichier .env en local, secrets en CI et sur la VM).
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
  // 0.0.0.0 = toutes les interfaces : indispensable pour être joignable dans un conteneur
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
