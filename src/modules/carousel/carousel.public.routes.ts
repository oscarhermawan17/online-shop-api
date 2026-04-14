import { Router } from 'express';

import * as carouselController from './carousel.public.controller';

const router = Router();

router.get('/', carouselController.getPublicCarouselSlides);

export default router;
