require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { notFound, errorHandler } = require('./middleware/error');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const CLIENT_BUILD = path.join(__dirname, '../client/build');

// --- Configuration ----------------------------------------------------------

if (!process.env.MONGO_URI && !process.env.MONGO_URL) {
  console.error('❌ MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set. Generate one with: openssl rand -base64 48');
  process.exit(1);
}

// --- Security middleware ---------------------------------------------------

app.set('trust proxy', 1); // required for correct client IPs behind Railway
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            // React sets style attributes inline, hence 'unsafe-inline' here.
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  })
);

// Only the declared front-end origin may call the API. Without CLIENT_ORIGIN we
// serve same-origin only, which is how the bundled production build works.
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // same-origin, curl, mobile
      if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Broad backstop; auth endpoints add a much tighter limiter of their own.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests, please slow down' },
  })
);

// --- Routes ----------------------------------------------------------------

app.get('/health', (req, res) => {
  // Reports the real DB state so Railway restarts on a broken connection.
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    db: connected ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
  });
});

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks',    require('./routes/tasks'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/warnings', require('./routes/warnings'));

// Unknown API routes must stay JSON 404s, never the SPA shell.
app.use('/api', notFound);

if (isProduction) {
  app.use(express.static(CLIENT_BUILD));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_BUILD, 'index.html'));
  });
}

// --- Error handling --------------------------------------------------------

app.use(notFound);
app.use(errorHandler);

// --- Startup ---------------------------------------------------------------

const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');

    // Build declared indexes instead of dropping them. A previous version wiped
    // every non-_id index on `users` on each boot, which silently destroyed any
    // index added later.
    try {
      await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
      console.log('✅ Indexes synced');
    } catch (err) {
      console.warn('⚠️  Index sync skipped:', err.message);
    }

    const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

    const shutdown = async (signal) => {
      console.log(`\n${signal} received, shutting down...`);
      server.close(() => {
        mongoose.connection.close(false).then(() => process.exit(0));
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });