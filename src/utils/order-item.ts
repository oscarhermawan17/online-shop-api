import prisma from '../config/prisma';

export const populateVariantDescriptions = async <
  T extends { variantId: string | null; variantDescription: string | null },
>(items: T[]): Promise<(T & { imageUrl: string | null })[]> => {
  const variantIds = items
    .filter((item) => item.variantId)
    .map((item) => item.variantId as string);

  if (variantIds.length === 0) return items.map((item) => ({ ...item, imageUrl: null }));

  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, name: true, isDefault: true, imageUrl: true },
  });

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  return items.map((item) => {
    const v = item.variantId ? variantMap.get(item.variantId) : undefined;
    const imageUrl = v?.imageUrl ?? null;

    if (!item.variantDescription && item.variantId && v && !v.isDefault && v.name) {
      return { ...item, variantDescription: v.name, imageUrl };
    }

    return { ...item, imageUrl };
  });
};
