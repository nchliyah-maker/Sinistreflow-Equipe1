const app = require('./app');
const config = require('./config');

app.listen(config.port, 'localhost', () => {
  console.log(`SinistreFlow démarré sur http://localhost:${config.port} (${config.env})`);
});
