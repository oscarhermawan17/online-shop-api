import type {
  Order,
  OrderItem,
  PaymentProof,
  ShippingShift,
  OrderShippingAssignment,
  Customer,
} from '@prisma/client';

type OrderWithRelations = Order & {
  items: OrderItem[];
  paymentProof: PaymentProof | null;
  customer: Customer;
  shippingAssignment?: (OrderShippingAssignment & {
    shift: ShippingShift;
  }) | null;
};

export const toAdminOrderResponse = (order: OrderWithRelations) => ({
  id: order.id,
  publicOrderId: order.publicOrderId,
  storeId: order.storeId,
  customerName: order.customerName,
  customerPhone: order.customerPhone,
  customerAddress: order.customerAddress,
  deliveryMethod: order.deliveryMethod,
  paymentMethod: order.paymentMethod,
  notes: order.notes,
  shippingCost: order.shippingCost,
  totalAmount: order.totalAmount,
  creditSettledAt: order.creditSettledAt,
  status: order.status,
  expiresAt: order.expiresAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  items: order.items,
  paymentProof: order.paymentProof,
  shippingAssignment: order.shippingAssignment
    ? {
        id: order.shippingAssignment.id,
        shiftId: order.shippingAssignment.shiftId,
        deliveryDate: order.shippingAssignment.deliveryDate,
        driverName: order.shippingAssignment.driverName,
        assignedAt: order.shippingAssignment.assignedAt,
        assignedByAdminId: order.shippingAssignment.assignedByAdminId,
        shiftName: order.shippingAssignment.shift.name,
        shiftStartTime: order.shippingAssignment.shift.startTime,
        shiftEndTime: order.shippingAssignment.shift.endTime,
        shiftLabel: `${order.shippingAssignment.shift.name} (${order.shippingAssignment.shift.startTime} - ${order.shippingAssignment.shift.endTime})`,
      }
    : null,
});
