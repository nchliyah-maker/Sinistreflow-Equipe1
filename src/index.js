const app = require('./app');
const config = require('./config');

app.listen(config.port, config.host, () => {
  console.log(`SinistreFlow démarré sur http://${config.host}:${config.port} (${config.env})`);
});
