import { Request, Response, NextFunction } from 'express';

import { sendSuccess } from '../../utils/response';
import * as carouselService from './carousel.service';

export const getPublicCarouselSlides = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const slides = await carouselService.getPublicCarouselSlides();
    sendSuccess(res, slides, 'Carousel slides fetched successfully');
  } catch (error) {
    next(error);
  }
};
