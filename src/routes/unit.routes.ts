import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as unitController from '../controllers/unit.controller';

const router = Router();

router.use(requireAuth);

router.get('/', unitController.listUnits);
router.get('/:id', unitController.getUnit);
router.post('/', unitController.createUnit);
router.patch('/:id', unitController.updateUnit);
router.delete('/:id', unitController.deleteUnit);

export default router;
