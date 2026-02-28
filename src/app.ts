import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorMiddleware } from './middlewares/error.middleware';

// ─── Route Imports ────────────────────────────────────────────────────────────
import healthRoutes from './modules/health/health.routes';
import docsRoutes from './modules/docs/docs.routes';
import authRoutes from './modules/auth/auth.routes';

// Public routes
import publicProductsRoutes from './modules/public/products/products.routes';
import checkoutRoutes from './modules/public/checkout/checkout.routes';

// Admin routes
import adminStoreRoutes from './modules/admin/store/store.routes';
import adminProductsRoutes from './modules/admin/products/products.routes';
import adminOrdersRoutes from './modules/admin/orders/orders.routes';

const app: Application = express();

// ─── Core Middlewares ─────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow Scalar UI to load
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(morgan('dev'));

// ─── Documentation Routes ─────────────────────────────────────────────────────
app.use('/api', docsRoutes);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

// Public APIs
app.use('/api/products', publicProductsRoutes);
app.use('/api', checkoutRoutes);

// Admin APIs (JWT required)
app.use('/api/admin/store', adminStoreRoutes);
app.use('/api/admin/products', adminProductsRoutes);
app.use('/api/admin/orders', adminOrdersRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found',
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Must be last middleware — 4-param signature required by Express
app.use(
  (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    errorMiddleware(err, req, res, next);
  },
);

export default app;
