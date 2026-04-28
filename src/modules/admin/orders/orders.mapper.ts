import type {
  Order,
  OrderItem,
  PaymentProof,
  ShippingShift,
  OrderShippingAssignment,
  OrderComplaint,
  OrderComplaintStatus,
  Prisma,
} from '@prisma/client';

const parseEvidenceImageUrls = (value: Prisma.JsonValue): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

type OrderWithRelations = Order & {
  items: OrderItem[];
  paymentProof: PaymentProof | null;
  complaints?: OrderComplaint[];
  shippingAssignment?: (OrderShippingAssignment & {
    shift: ShippingShift;
  }) | null;
};

export interface AdminOrderComplaintResponse {
  id: string;
  orderId: string;
  customerId: string;
  comment: string;
  evidenceImageUrls: string[];
  status: OrderComplaintStatus;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  resolvedAt: Date | null;
  acceptedByAdminId: string | null;
  rejectedByAdminId: string | null;
  resolvedByAdminId: string | null;
}

export const toAdminOrderComplaintResponse = (
  complaint: OrderComplaint,
): AdminOrderComplaintResponse => ({
  id: complaint.id,
  orderId: complaint.orderId,
  customerId: complaint.customerId,
  comment: complaint.comment,
  evidenceImageUrls: parseEvidenceImageUrls(complaint.evidenceImageUrls),
  status: complaint.status,
  adminNote: complaint.adminNote,
  createdAt: complaint.createdAt,
  updatedAt: complaint.updatedAt,
  acceptedAt: complaint.acceptedAt,
  rejectedAt: complaint.rejectedAt,
  resolvedAt: complaint.resolvedAt,
  acceptedByAdminId: complaint.acceptedByAdminId,
  rejectedByAdminId: complaint.rejectedByAdminId,
  resolvedByAdminId: complaint.resolvedByAdminId,
});

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
  adminCompletedAt: order.adminCompletedAt,
  customerCompletedAt: order.customerCompletedAt,
  status: order.status,
  expiresAt: order.expiresAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  items: order.items,
  paymentProof: order.paymentProof,
  complaints: (order.complaints ?? []).map(toAdminOrderComplaintResponse),
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
