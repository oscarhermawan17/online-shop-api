import prisma from '../config/prisma';

/**
 * For items where variantDescription was stored as null (products using variant.name
 * rather than option values), look up the variant name in a single batch query and
 * fill it in. Items that already have a description are unchanged.
 */
export const populateVariantDescriptions = async <
  T extends { variantId: string | null; variantDescription: string | null },
>(items: T[]): Promise<T[]> => {
  const missingIds = items
    .filter((item) => !item.variantDescription && item.variantId)
    .map((item) => item.variantId as string);

  if (missingIds.length === 0) return items;

  const variants = await prisma.variant.findMany({
    where: { id: { in: missingIds } },
    select: { id: true, name: true, isDefault: true },
  });

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  return items.map((item) => {
    if (item.variantDescription || !item.variantId) return item;
    const v = variantMap.get(item.variantId);
    if (!v || v.isDefault || !v.name) return item;
    return { ...item, variantDescription: v.name };
  });
};
