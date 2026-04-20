import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { AppError } from '../../../middlewares/error.middleware';
import { sendPaginatedSuccess, sendSuccess } from '../../../utils/response';
import { sendXls } from '../../../utils/xls';
import * as receivablesService from './receivables.service';

const toIsoDateTime = (value: Date): string => value.toISOString().replace('T', ' ').slice(0, 19);

const readQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
};

const parseDateQuery = (value: unknown, fieldName: string): Date | undefined => {
  const raw = readQueryString(value);

  if (!raw) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new AppError(`Format ${fieldName} harus YYYY-MM-DD`, 400);
  }

  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${fieldName} tidak valid`, 400);
  }

  return parsed;
};

const parseSettledFilter = (value: unknown): 'settled' | 'unsettled' | undefined => {
  const raw = readQueryString(value);

  if (!raw || raw === 'all') {
    return undefined;
  }

  if (raw === 'settled' || raw === 'unsettled') {
    return raw;
  }

  throw new AppError('settled harus bernilai settled | unsettled | all', 400);
};

const parseReceivableFilters = (req: AuthRequest) => {
  const parsedPage = parseInt(String(req.query.page ?? '1'), 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = [10, 25, 50, 100].includes(Number(req.query.limit))
    ? Number(req.query.limit)
    : 25;
  const settled = parseSettledFilter(req.query.settled);
  const startDate = parseDateQuery(req.query.startDate, 'startDate');
  const endDate = parseDateQuery(req.query.endDate, 'endDate');

  if (startDate && endDate && endDate < startDate) {
    throw new AppError('endDate harus sama atau setelah startDate', 400);
  }

  const endDateExclusive = endDate
    ? new Date(endDate.getTime() + (24 * 60 * 60 * 1000))
    : undefined;

  return {
    page,
    limit,
    settled,
    startDate,
    endDate,
    endDateExclusive,
  };
};

export const listReceivables = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const filters = parseReceivableFilters(req);

    const { receivables, total } = await receivablesService.listReceivables({
      storeId: req.user!.storeId,
      page: filters.page,
      limit: filters.limit,
      settled: filters.settled,
      startDate: filters.startDate,
      endDateExclusive: filters.endDateExclusive,
    });

    const totalPages = Math.max(1, Math.ceil(total / filters.limit));

    sendPaginatedSuccess(
      res,
      receivables,
      {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
      'Receivables fetched successfully',
    );
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
    const filters = parseReceivableFilters(req);

    const { receivables } = await receivablesService.listReceivables({
      storeId: req.user!.storeId,
      settled: filters.settled,
      startDate: filters.startDate,
      endDateExclusive: filters.endDateExclusive,
    });

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
          { label: 'Filter Status', value: filters.settled ?? 'all' },
          { label: 'Start Date', value: filters.startDate ? toIsoDateTime(filters.startDate) : '-' },
          { label: 'End Date', value: filters.endDate ? toIsoDateTime(filters.endDate) : '-' },
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
