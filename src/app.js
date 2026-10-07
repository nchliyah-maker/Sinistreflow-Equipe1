const path = require('path');
const express = require('express');

const healthRoutes = require('./api/health');
const publicRoutes = require('./api/public/declarations');
const internalRoutes = require('./api/internal/backoffice');
const v1Routes = require('./api/v1/claims');
const v2Routes = require('./api/v2/claims');
const v3Routes = require('./api/v3/claims');
const apiKeyAuth = require('./api/middlewares/apiKey');
const errorHandler = require('./api/middlewares/errorHandler');
const metrics = require('./metrics');
const { NotFoundError } = require('./domain/errors');

const app = express();

app.use(metrics.middleware);
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(healthRoutes);
// Lu par Prometheus. À ne pas exposer sur Internet : bloqué par nginx (voir deploy/)
app.get('/metrics', metrics.handler);
app.use(['/api/public', '/api/internal', '/api/v1', '/api/v2', '/api/v3'], metrics.rememberMount);
app.use('/api/public', publicRoutes);
app.use('/api/internal', internalRoutes);

// API partenaires (versionnée)
app.use('/api/v1', apiKeyAuth, v1Routes);
app.use('/api/v2', apiKeyAuth, v2Routes);
app.use('/api/v3', apiKeyAuth, v3Routes);

app.use('/api', (req, res, next) => next(new NotFoundError(`Route inconnue : ${req.method} ${req.originalUrl}`)));
app.use(errorHandler);

module.exports = app;
