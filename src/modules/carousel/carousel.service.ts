import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/error.middleware';

export interface CarouselSlideInput {
  id?: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  imageUrl?: string;
  backgroundColor?: string;
  showText?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

const DEFAULT_BACKGROUND_COLOR = '#166534';
const HEX_COLOR_REGEX = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const isMissingShowTextColumnError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('carousel_slides.showText');
};

const normalizeOptionalString = (value?: string | null) => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

const normalizeColor = (value?: string | null) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return DEFAULT_BACKGROUND_COLOR;
  }

  if (!HEX_COLOR_REGEX.test(trimmedValue)) {
    throw new AppError('Background color must be a valid hex color', 400);
  }

  return trimmedValue;
};

const normalizeSlideInput = (
  slide: CarouselSlideInput,
  index: number,
): Required<Pick<CarouselSlideInput, 'backgroundColor' | 'isActive'>> &
  Pick<CarouselSlideInput, 'id'> & {
    title: string;
    subtitle: string | null;
    badge: string | null;
    imageUrl: string | null;
    showText: boolean;
    sortOrder: number;
  } => {
  const title = normalizeOptionalString(slide.title) ?? '';

  if (title.length > 120) {
    throw new AppError(`Slide ${index + 1}: title must be at most 120 characters`, 400);
  }

  const subtitle = normalizeOptionalString(slide.subtitle);
  const badge = normalizeOptionalString(slide.badge);
  const imageUrl = normalizeOptionalString(slide.imageUrl);

  if (subtitle && subtitle.length > 240) {
    throw new AppError(`Slide ${index + 1}: subtitle must be at most 240 characters`, 400);
  }

  if (badge && badge.length > 50) {
    throw new AppError(`Slide ${index + 1}: badge must be at most 50 characters`, 400);
  }

  if (imageUrl) {
    try {
      const parsedUrl = new URL(imageUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('invalid protocol');
      }
    } catch {
      throw new AppError(`Slide ${index + 1}: imageUrl must be a valid URL`, 400);
    }
  }

  return {
    id: slide.id,
    title,
    subtitle,
    badge,
    imageUrl,
    backgroundColor: normalizeColor(slide.backgroundColor),
    showText: slide.showText ?? true,
    isActive: slide.isActive ?? true,
    sortOrder: index,
  };
};

const ensureSlidesPayload = (slides: unknown): CarouselSlideInput[] => {
  if (!Array.isArray(slides)) {
    throw new AppError('Slides payload must be an array', 400);
  }

  if (slides.length === 0) {
    throw new AppError('At least one carousel slide is required', 400);
  }

  if (slides.length > 10) {
    throw new AppError('Carousel supports a maximum of 10 slides', 400);
  }

  return slides as CarouselSlideInput[];
};

const getStoreOrThrow = async (storeId?: string) => {
  const store = storeId
    ? await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } })
    : await prisma.store.findFirst({ select: { id: true } });

  if (!store) {
    throw new AppError('Store not found', 404);
  }

  return store;
};

export const getPublicCarouselSlides = async () => {
  const store = await getStoreOrThrow();

  try {
    return await prisma.carouselSlide.findMany({
      where: {
        storeId: store.id,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  } catch (error) {
    if (!isMissingShowTextColumnError(error)) {
      throw error;
    }

    const fallbackSlides = await prisma.carouselSlide.findMany({
      where: {
        storeId: store.id,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        storeId: true,
        title: true,
        subtitle: true,
        badge: true,
        imageUrl: true,
        backgroundColor: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return fallbackSlides.map((slide) => ({
      ...slide,
      showText: true,
    }));
  }
};

export const getAdminCarouselSlides = async (storeId: string) => {
  await getStoreOrThrow(storeId);

  try {
    return await prisma.carouselSlide.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  } catch (error) {
    if (!isMissingShowTextColumnError(error)) {
      throw error;
    }

    const fallbackSlides = await prisma.carouselSlide.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        storeId: true,
        title: true,
        subtitle: true,
        badge: true,
        imageUrl: true,
        backgroundColor: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return fallbackSlides.map((slide) => ({
      ...slide,
      showText: true,
    }));
  }
};

export const replaceCarouselSlides = async (
  storeId: string,
  slidesPayload: unknown,
) => {
  await getStoreOrThrow(storeId);

  const slides = ensureSlidesPayload(slidesPayload).map((slide, index) =>
    normalizeSlideInput(slide, index),
  );

  if (!slides.some((slide) => slide.isActive)) {
    throw new AppError('At least one carousel slide must be active', 400);
  }

  const existingSlides = await prisma.carouselSlide.findMany({
    where: { storeId },
    select: { id: true, createdAt: true },
  });
  const existingSlidesMap = new Map(
    existingSlides.map((slide) => [slide.id, slide] as const),
  );

  const runReplaceTransaction = async (omitShowText: boolean) =>
    prisma.$transaction(async (tx) => {
      await tx.carouselSlide.deleteMany({
        where: { storeId },
      });

      if (slides.length === 0) {
        return [];
      }

      const createdSlides = await Promise.all(
        slides.map((slide) =>
          tx.carouselSlide.create({
            data: {
              id: slide.id ?? undefined,
              storeId,
              title: slide.title,
              subtitle: slide.subtitle,
              badge: slide.badge,
              imageUrl: slide.imageUrl,
              backgroundColor: slide.backgroundColor,
              ...(omitShowText ? {} : { showText: slide.showText }),
              isActive: slide.isActive,
              sortOrder: slide.sortOrder,
              createdAt:
                slide.id && existingSlidesMap.has(slide.id)
                  ? existingSlidesMap.get(slide.id)!.createdAt
                  : undefined,
            },
          }),
        ),
      );

      return createdSlides
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((slide) => ({
          ...slide,
          showText: slide.showText ?? true,
        }));
    });

  try {
    return await runReplaceTransaction(false);
  } catch (error) {
    if (!isMissingShowTextColumnError(error)) {
      throw error;
    }

    return runReplaceTransaction(true);
  }
};
