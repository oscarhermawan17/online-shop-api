import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as carouselController from './carousel.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('manager'));

router.get('/', carouselController.getCarouselSlides);
router.put('/', carouselController.replaceCarouselSlides);

export default router;
