import { Router } from 'express';
import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as controller from './shipping-zones.controller';

const router = Router();

router.use(requireAuth);

// GET /admin/shipping-zones
router.get('/', requireRole('manager'), controller.getShippingZones);

// PUT /admin/shipping-zones (bulk upsert)
router.put('/', requireRole('manager'), controller.bulkUpsertShippingZones);

// PATCH /admin/shipping-zones/:id
router.patch('/:id', requireRole('manager'), controller.updateShippingZone);

// DELETE /admin/shipping-zones/:id
router.delete('/:id', requireRole('manager'), controller.deleteShippingZone);

export default router;
