import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import * as carouselService from '../../carousel/carousel.service';

export const getCarouselSlides = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const slides = await carouselService.getAdminCarouselSlides(req.user!.storeId);
    sendSuccess(res, slides, 'Carousel slides fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const replaceCarouselSlides = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const slides = await carouselService.replaceCarouselSlides(
      req.user!.storeId,
      req.body?.slides,
    );
    sendSuccess(res, slides, 'Carousel slides updated successfully');
  } catch (error) {
    next(error);
  }
};
