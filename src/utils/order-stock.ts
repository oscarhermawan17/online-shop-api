import { StockLedgerClient, recordStockMovement } from './stock-ledger';

interface RestoreOrderStockItem {
  variantId: string | null;
  quantity: number;
}

interface RestoreOrderStockInput {
  storeId: string;
  orderId: string;
  items: RestoreOrderStockItem[];
  notes: string;
}

export const restoreOrderStock = async (
  db: StockLedgerClient,
  input: RestoreOrderStockInput,
) => {
  const { storeId, orderId, items, notes } = input;

  for (const item of items) {
    if (!item.variantId || item.quantity <= 0) {
      continue;
    }

    const restoredVariant = await db.variant.update({
      where: { id: item.variantId },
      data: { stock: { increment: item.quantity } },
      select: {
        id: true,
        productId: true,
        stock: true,
      },
    });

    await recordStockMovement(db, {
      storeId,
      productId: restoredVariant.productId,
      variantId: restoredVariant.id,
      stockStatus: 'in',
      quantity: item.quantity,
      category: 'restore',
      balanceAfter: restoredVariant.stock,
      referenceType: 'order',
      referenceId: orderId,
      notes,
    });
  }
};

