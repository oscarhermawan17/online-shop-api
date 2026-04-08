import prisma from '../../../config/prisma';

export const getShippingZones = async (storeId: string) => {
  return prisma.shippingZone.findMany({
    where: { storeId },
    orderBy: { name: 'asc' },
  });
};

export const upsertShippingZone = async (
  storeId: string,
  data: { name: string; cost: number; isActive?: boolean },
) => {
  return prisma.shippingZone.upsert({
    where: { storeId_name: { storeId, name: data.name } },
    create: {
      storeId,
      name: data.name,
      cost: data.cost,
      isActive: data.isActive ?? true,
    },
    update: {
      cost: data.cost,
      isActive: data.isActive,
    },
  });
};

export const bulkUpsertShippingZones = async (
  storeId: string,
  zones: { name: string; cost: number; isActive?: boolean }[],
) => {
  const results = await Promise.all(
    zones.map((zone) => upsertShippingZone(storeId, zone)),
  );
  return results;
};

export const deleteShippingZone = async (storeId: string, id: string) => {
  return prisma.shippingZone.deleteMany({
    where: { id, storeId },
  });
};
