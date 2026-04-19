import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import { sendXls } from '../../../utils/xls';
import * as dashboardService from './dashboard.service';

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const toIsoDateTime = (value: Date): string => value.toISOString().replace('T', ' ').slice(0, 19);

const paymentMethodLabel = (value: string | null): string => {
  if (value === 'credit') return 'Credit';
  if (value === 'bank_transfer') return 'Transfer';
  return '-';
};

const deliveryMethodLabel = (value: string | null): string => {
  if (value === 'delivery') return 'Delivery';
  if (value === 'pickup') return 'Pickup';
  return '-';
};

// ─── GET /admin/dashboard ─────────────────────────────────────────────────────

export const getDashboardData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { period, startDate, endDate } = req.query;
    const data = await dashboardService.getDashboardData(
      req.user!.storeId,
      period as string,
      startDate as string,
      endDate as string,
    );
    sendSuccess(res, data, 'Dashboard data fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/dashboard/export/sales ───────────────────────────────────────

export const exportSalesReport = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { period, startDate, endDate } = req.query;

    const report = await dashboardService.getSalesReportData(
      req.user!.storeId,
      period as string,
      startDate as string,
      endDate as string,
    );

    sendXls(res, {
      filename: `sales-report-${toIsoDate(report.startDate)}_${toIsoDate(report.endDate)}.xls`,
      sheetName: 'Sales Report',
      table: {
        title: 'Laporan Penjualan',
        subtitle: 'Data mengikuti filter dashboard admin.',
        metadata: [
          { label: 'Period', value: report.period },
          { label: 'Range', value: `${toIsoDate(report.startDate)} s/d ${toIsoDate(report.endDate)}` },
          { label: 'Total Orders', value: report.totalOrders },
          { label: 'Total Sales', value: report.totalSales },
          { label: 'Generated At', value: toIsoDateTime(new Date()) },
        ],
        headers: [
          'Tanggal',
          'Order ID',
          'Pelanggan',
          'No HP',
          'Metode Bayar',
          'Metode Kirim',
          'Status',
          'Total Item',
          'Ongkir',
          'Total',
          'Lunas Credit',
          'Ringkasan Item',
        ],
        rows: report.rows.map((row) => [
          toIsoDateTime(row.createdAt),
          row.publicOrderId,
          row.customerName || '-',
          row.customerPhone || '-',
          paymentMethodLabel(row.paymentMethod),
          deliveryMethodLabel(row.deliveryMethod),
          row.status,
          row.totalItems,
          row.shippingCost,
          row.totalAmount,
          row.creditSettledAt ? toIsoDateTime(row.creditSettledAt) : '-',
          row.itemsSummary,
        ]),
      },
    });
  } catch (error) {
    next(error);
  }
};
