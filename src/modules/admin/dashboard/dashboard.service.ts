import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

interface DashboardRanges {
  period: string;
  startDate: Date;
  endDate: Date;
  prevStartDate: Date;
  prevEndDate: Date;
}

const resolveDashboardRanges = (
  period?: string,
  startDateStr?: string,
  endDateStr?: string,
): DashboardRanges => {
  const now = new Date();
  const selectedPeriod = period || 'today';

  let startDate: Date;
  let endDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;

  if (period === 'custom' && startDateStr && endDateStr) {
    startDate = new Date(startDateStr);
    endDate = new Date(endDateStr);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new AppError('Invalid custom date range', 400);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    prevEndDate = new Date(startDate.getTime() - 1);
    prevStartDate = new Date(prevEndDate.getTime() - diffTime);
  } else if (period === 'yesterday') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    prevStartDate = new Date(startDate);
    prevStartDate.setDate(startDate.getDate() - 1);
    prevEndDate = new Date(prevStartDate);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (period === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (period === 'last_month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
  } else {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    prevStartDate = new Date(startDate);
    prevStartDate.setDate(startDate.getDate() - 1);
    prevEndDate = new Date(prevStartDate);
    prevEndDate.setHours(23, 59, 59, 999);
  }

  return {
    period: selectedPeriod,
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
  };
};

export const getDashboardData = async (
  storeId: string,
  period?: string,
  startDateStr?: string,
  endDateStr?: string,
) => {
  const {
    period: resolvedPeriod,
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
  } = resolveDashboardRanges(period, startDateStr, endDateStr);

  const currentOrders = await prisma.order.findMany({
    where: {
      storeId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        notIn: ['cancelled', 'expired_unpaid'],
      },
    },
    include: {
      items: true,
    },
  });

  const prevOrders = await prisma.order.findMany({
    where: {
      storeId,
      createdAt: {
        gte: prevStartDate,
        lte: prevEndDate,
      },
      status: {
        notIn: ['cancelled', 'expired_unpaid'],
      },
    },
  });

  const totalSales = currentOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const totalOrders = currentOrders.length;

  const prevTotalSales = prevOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const prevTotalOrders = prevOrders.length;

  const salesGrowth = prevTotalSales === 0
    ? (totalSales > 0 ? 100 : 0)
    : ((totalSales - prevTotalSales) / prevTotalSales) * 100;

  const ordersGrowth = prevTotalOrders === 0
    ? (totalOrders > 0 ? 100 : 0)
    : ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100;

  const newCustomersCount = await prisma.customer.count({
    where: {
      storeId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const prevNewCustomersCount = await prisma.customer.count({
    where: {
      storeId,
      createdAt: {
        gte: prevStartDate,
        lte: prevEndDate,
      },
    },
  });

  const customersGrowth = prevNewCustomersCount === 0
    ? (newCustomersCount > 0 ? 100 : 0)
    : ((newCustomersCount - prevNewCustomersCount) / prevNewCustomersCount) * 100;

  const chartsData: { label: string; value: number }[] = [];
  if (
    period === 'this_month'
    || period === 'last_month'
    || (period === 'custom' && (endDate.getTime() - startDate.getTime()) > 3 * 24 * 60 * 60 * 1000)
  ) {
    const daysMap = new Map<string, number>();

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      daysMap.set(d.toISOString().split('T')[0], 0);
    }

    currentOrders.forEach((order) => {
      const dateStr = order.createdAt.toISOString().split('T')[0];
      if (daysMap.has(dateStr)) {
        daysMap.set(dateStr, daysMap.get(dateStr)! + order.totalAmount);
      }
    });

    for (const [date, amount] of daysMap.entries()) {
      chartsData.push({ label: date, value: amount });
    }
  } else {
    const hoursMap = new Map<string, number>();

    for (let i = 0; i < 24; i += 1) {
      hoursMap.set(`${i.toString().padStart(2, '0')}:00`, 0);
    }

    currentOrders.forEach((order) => {
      const hourStr = `${order.createdAt.getHours().toString().padStart(2, '0')}:00`;
      if (hoursMap.has(hourStr)) {
        hoursMap.set(hourStr, hoursMap.get(hourStr)! + order.totalAmount);
      }
    });

    for (const [hour, amount] of hoursMap.entries()) {
      chartsData.push({ label: hour, value: amount });
    }
  }

  const itemCounts = new Map<string, { name: string; count: number; value: number }>();

  currentOrders.forEach((order) => {
    order.items.forEach((item) => {
      const existing = itemCounts.get(item.productName)
        || { name: item.productName, count: 0, value: 0 };

      existing.count += item.quantity;
      existing.value += item.price * item.quantity;
      itemCounts.set(item.productName, existing);
    });
  });

  const itemsArray = Array.from(itemCounts.values());

  const mostSoldByCount = [...itemsArray]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const mostSoldByValue = [...itemsArray]
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    period: resolvedPeriod,
    startDate,
    endDate,
    statistics: {
      totalSales,
      totalOrders,
      newCustomers: newCustomersCount,
    },
    comparison: {
      prevTotalSales,
      prevTotalOrders,
      prevNewCustomers: prevNewCustomersCount,
      salesGrowth,
      ordersGrowth,
      customersGrowth,
    },
    charts: {
      salesTrend: chartsData,
    },
    rankings: {
      mostSoldByCount,
      mostSoldByValue,
    },
  };
};

export const getSalesReportData = async (
  storeId: string,
  period?: string,
  startDateStr?: string,
  endDateStr?: string,
) => {
  const { period: resolvedPeriod, startDate, endDate } = resolveDashboardRanges(
    period,
    startDateStr,
    endDateStr,
  );

  const orders = await prisma.order.findMany({
    where: {
      storeId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        notIn: ['cancelled', 'expired_unpaid'],
      },
    },
    include: {
      items: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const rows = orders.map((order) => {
    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const itemsSummary = order.items
      .map((item) => `${item.productName}${item.variantDescription ? ` (${item.variantDescription})` : ''} x${item.quantity}`)
      .join('; ');

    return {
      createdAt: order.createdAt,
      publicOrderId: order.publicOrderId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      paymentMethod: order.paymentMethod,
      deliveryMethod: order.deliveryMethod,
      status: order.status,
      totalItems,
      shippingCost: order.shippingCost,
      totalAmount: order.totalAmount,
      creditSettledAt: order.creditSettledAt,
      itemsSummary,
    };
  });

  return {
    period: resolvedPeriod,
    startDate,
    endDate,
    totalOrders: rows.length,
    totalSales: rows.reduce((sum, row) => sum + row.totalAmount, 0),
    rows,
  };
};
