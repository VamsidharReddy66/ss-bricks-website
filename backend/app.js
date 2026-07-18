const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const sanitizeRequest = require('./middleware/sanitizeRequest');
const quoteRoutes = require('./routes/quoteRoutes');
const productRoutes = require('./routes/productRoutes');
const calculatorRoutes = require('./routes/calculatorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { errorResponse } = require('./utils/apiResponse');

const app = express();
const publicRoot = path.join(__dirname, '..');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: env.corsOrigin.split(',').map((origin) => origin.trim()),
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => errorResponse(res, 429, 'Too many requests. Please try again shortly.', [
    {
      field: 'request',
      message: 'Request limit exceeded.',
    },
  ]),
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => errorResponse(res, 429, 'Too many login attempts. Please try again after 15 minutes.', [
    {
      field: 'credentials',
      message: 'Login attempt limit exceeded.',
    },
  ]),
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(sanitizeRequest);

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'SS Bricks API is healthy.',
    data: {
      uptime: process.uptime(),
    },
  });
});

app.use('/api/admin/login', adminLoginLimiter);
app.use('/api', apiLimiter);
app.use('/api/quotes', quoteRoutes);
app.use('/api/products', productRoutes);
app.use('/api/calculator', calculatorRoutes);
app.use('/api/admin', adminRoutes);
app.use(express.static(publicRoot));

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicRoot, 'index.html'));
});

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
