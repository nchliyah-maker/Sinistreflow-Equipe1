const app = require('./app');
const config = require('./config');
const logger = require('./logger');

app.listen(config.port, config.host, () => {
  logger.info('SinistreFlow démarré', { host: config.host, port: config.port, env: config.env });
});
