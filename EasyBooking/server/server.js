import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import organizerRoutes from './routes/organizerRoutes.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { seedDatabase } from './seed.js';
import { configureLocalDotenv } from './utils/local-env.js';

// ====== Load environment variables ======
configureLocalDotenv(import.meta.url);
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
const app = express();

// ====== App configuration ======
const BODY_LIMIT = process.env.BODY_LIMIT || '5mb';

// ✅ Allow both local dev + Netlify deployment
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
  : [
      'http://localhost:5173', // local Vue dev (default port)
      'https://pro-event-booking.netlify.app', // Netlify production frontend
    ];

const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', 'local.host']);

const isLocalDevOrigin = (origin = '') => {
  try {
    const { hostname } = new URL(origin);
    return LOCAL_DEV_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
};

// ====== CORS Middleware ======
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // allow Postman/server requests

      if (allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
        return callback(null, true);
      }

      console.warn(`❌ Blocked by CORS: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ====== Global Middlewares ======
app.use(express.json({ limit: BODY_LIMIT }));
app.use(cookieParser());

// ====== Debug Logging ======
app.use((req, _res, next) => {
  console.log(`➡️  ${req.method} ${req.originalUrl}`);
  next();
});

// ====== Routes ======
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/organizer', organizerRoutes);

// ====== Health Check Routes ======
app.get('/', (_req, res) =>
  res.status(200).send('✅ Server is running on Railway')
);
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// ====== Error Handlers ======
app.use(notFoundHandler);
app.use(errorHandler);

// ====== MongoDB Connection & Server Start ======
const PORT = process.env.PORT || 8080; // ✅ Railway auto-assigns a port

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Mongo connected');

    try {
      await seedDatabase();
      console.log('🌱 Database seed completed on startup');
    } catch (seedError) {
      console.error('❌ Database seeding failed:', seedError);
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('🌐 Allowed Origins:', allowedOrigins);
    });
  })
  .catch((err) => {
    console.error('❌ Mongo connection error:', err);
    process.exit(1);
  });

export default app;
