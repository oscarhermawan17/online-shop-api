import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorMiddleware } from './middlewares/error.middleware';

// ─── Route Imports ────────────────────────────────────────────────────────────
import healthRoutes from './modules/health/health.routes';
import docsRoutes from './modules/docs/docs.routes';
import authRoutes from './modules/auth/auth.routes';
import customerAuthRoutes from './modules/customer-auth/customer-auth.routes';

// Public routes
import publicStoreRoutes from './modules/store/store.public.routes';
import publicProductsRoutes from './modules/public/products/products.routes';
import checkoutRoutes from './modules/public/checkout/checkout.routes';
import publicCategoryRoutes from './routes/public.category.routes';

// Admin routes
import adminStoreRoutes from './modules/admin/store/store.routes';
import adminProductsRoutes from './modules/admin/products/products.routes';
import adminOrdersRoutes from './modules/admin/orders/orders.routes';
import adminCustomerRoutes from './modules/admin/customers/customers.routes';
import adminShippingZonesRoutes from './modules/admin/shipping-zones/shipping-zones.routes';
import adminShippingDriversRoutes from './modules/admin/shipping-drivers/shipping-drivers.routes';
import adminShippingShiftsRoutes from './modules/admin/shipping-shifts/shipping-shifts.routes';
import publicShippingZonesRoutes from './modules/store/shipping-zones.public.routes';

// New routes for Category and Unit
import categoryRoutes from './routes/category.routes';
import unitRoutes from './routes/unit.routes';

// Customer routes
import customerOrdersRoutes from './modules/customer/orders/orders.routes';
import customerAddressesRoutes from './modules/customer/addresses/addresses.routes';

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
app.use('/api/customer-auth', customerAuthRoutes);

// Public APIs
app.use('/api/store', publicStoreRoutes);
app.use('/api/products', publicProductsRoutes);
app.use('/api/categories', publicCategoryRoutes);
app.use('/api', checkoutRoutes);
app.use('/api/shipping-zones', publicShippingZonesRoutes);

// Admin APIs (JWT required)
app.use('/api/admin/store', adminStoreRoutes);
app.use('/api/admin/products', adminProductsRoutes);
app.use('/api/admin/orders', adminOrdersRoutes);
app.use('/api/admin/customers', adminCustomerRoutes);
app.use('/api/admin/shipping-zones', adminShippingZonesRoutes);
app.use('/api/admin/shipping-drivers', adminShippingDriversRoutes);
app.use('/api/admin/shipping-shifts', adminShippingShiftsRoutes);
app.use('/api/admin/categories', categoryRoutes);
app.use('/api/admin/units', unitRoutes);

// Customer APIs (customer JWT required)
app.use('/api/customer/orders', customerOrdersRoutes);
app.use('/api/customer/addresses', customerAddressesRoutes);

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
