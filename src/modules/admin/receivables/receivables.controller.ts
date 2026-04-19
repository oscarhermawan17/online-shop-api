import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import { sendXls } from '../../../utils/xls';
import * as receivablesService from './receivables.service';

const toIsoDateTime = (value: Date): string => value.toISOString().replace('T', ' ').slice(0, 19);

export const listReceivables = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await receivablesService.listReceivables(req.user!.storeId);
    sendSuccess(res, result, 'Receivables fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const exportReceivables = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const receivables = await receivablesService.listReceivables(req.user!.storeId);

    const totals = receivables.reduce(
      (acc, item) => {
        acc.invoice += 1;
        acc.total += item.totalAmount;
        acc.paid += item.paidAmount;
        acc.remaining += item.remainingAmount;
        return acc;
      },
      { invoice: 0, total: 0, paid: 0, remaining: 0 },
    );

    sendXls(res, {
      filename: `receivables-report-${new Date().toISOString().slice(0, 10)}.xls`,
      sheetName: 'Receivables Report',
      table: {
        title: 'Laporan Piutang',
        subtitle: 'Daftar invoice credit dan status pembayarannya.',
        metadata: [
          { label: 'Total Invoice', value: totals.invoice },
          { label: 'Total Nilai Invoice', value: totals.total },
          { label: 'Total Dibayar', value: totals.paid },
          { label: 'Sisa Piutang', value: totals.remaining },
          { label: 'Generated At', value: toIsoDateTime(new Date()) },
        ],
        headers: [
          'Invoice',
          'Tanggal Invoice',
          'Pelanggan',
          'No HP',
          'Total',
          'Dibayar',
          'Sisa',
          'Status Order',
          'Status Piutang',
          'Jumlah Cicilan',
          'Pembayaran Terakhir',
        ],
        rows: receivables.map((invoice) => {
          const lastPayment = invoice.payments[0];

          return [
            invoice.publicOrderId,
            toIsoDateTime(new Date(invoice.createdAt)),
            invoice.customerName || '-',
            invoice.customerPhone || '-',
            invoice.totalAmount,
            invoice.paidAmount,
            invoice.remainingAmount,
            invoice.status,
            invoice.isSettled ? 'LUNAS' : 'BELUM LUNAS',
            invoice.payments.length,
            lastPayment ? toIsoDateTime(new Date(lastPayment.receivedAt)) : '-',
          ];
        }),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await receivablesService.addReceivablePayment({
      orderId: req.params.id as string,
      storeId: req.user!.storeId,
      amount: Number(req.body.amount),
      receivedAt: String(req.body.receivedAt),
    });

    sendSuccess(res, result, 'Receivable payment saved successfully', 201);
  } catch (error) {
    next(error);
  }
};
