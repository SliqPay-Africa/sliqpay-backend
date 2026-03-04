import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { notFound } from './common/middleware/notFound.js';
import { errorHandler } from './common/middleware/errorHandler.js';
import { sessionMiddleware } from './common/session/sessionStore.js';
import { rateLimit } from './common/middleware/rateLimit.js';
import { PrismaClient } from '@prisma/client';

export const app = express();
// Helmet's type export may be treated as a namespace in some toolchains; cast to any
// to avoid a TS2349 "not callable" error in CI/build environments. This is a
// minimal fix — prefer updating @types/helmet or the import style if desired.
app.use((helmet as unknown as any)());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware());
// Optional: global soft rate limit to protect API surface (very permissive)
app.use(rateLimit({ bucket: 'api:global', windowSeconds: 60, limit: 600 }));
app.use(morgan('dev'));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🚀 SliqPay API is alive and kicking!',
    status: 'healthy',
    documentation: 'https://github.com/Findy-WID/SliqPay-Backend#readme',
    health: '/api/v1/health',
    version: 'v1'
  });
});

app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

// Database connection log
const prisma = new PrismaClient();
prisma.$connect()
  .then(() => {
    console.log(' Connected to the database');
  })
  .catch((err: any) => {
    console.error(' Failed to connect to the database:', err);
  });
