import { CustomerJwtPayload } from '../middlewares/customer-auth.middleware';

declare global {
  namespace Express {
    interface Request {
      customer?: CustomerJwtPayload;
    }
  }
}
