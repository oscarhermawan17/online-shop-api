import prisma from '../../../config/prisma';

export const getDashboardData = async (
  storeId: string,
  period?: string,
  startDateStr?: string,
  endDateStr?: string,
) => {
  let startDate: Date;
  let endDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;

  const now = new Date();

  if (period === 'custom' && startDateStr && endDateStr) {
    startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(endDateStr);
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
    // Default to 'today'
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    prevStartDate = new Date(startDate);
    prevStartDate.setDate(startDate.getDate() - 1);
    prevEndDate = new Date(prevStartDate);
    prevEndDate.setHours(23, 59, 59, 999);
  }

  // Fetch current period orders
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

  // Fetch previous period orders
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

  // Calculate stats
  const totalSales = currentOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const totalOrders = currentOrders.length;

  const prevTotalSales = prevOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const prevTotalOrders = prevOrders.length;

  const salesGrowth = prevTotalSales === 0 ? (totalSales > 0 ? 100 : 0) : ((totalSales - prevTotalSales) / prevTotalSales) * 100;
  const ordersGrowth = prevTotalOrders === 0 ? (totalOrders > 0 ? 100 : 0) : ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100;

  // New customers
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

  const customersGrowth = prevNewCustomersCount === 0 ? (newCustomersCount > 0 ? 100 : 0) : ((newCustomersCount - prevNewCustomersCount) / prevNewCustomersCount) * 100;

  // Charts Data (Sales Trend)
  const chartsData: { label: string; value: number }[] = [];
  if (period === 'this_month' || period === 'last_month' || (period === 'custom' && (endDate.getTime() - startDate.getTime()) > 3 * 24 * 60 * 60 * 1000)) {
    const daysMap = new Map<string, number>();
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      daysMap.set(d.toISOString().split('T')[0], 0);
    }

    currentOrders.forEach(order => {
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
    for (let i = 0; i < 24; i++) {
      hoursMap.set(`${i.toString().padStart(2, '0')}:00`, 0);
    }

    currentOrders.forEach(order => {
      const hourStr = `${order.createdAt.getHours().toString().padStart(2, '0')}:00`;
      if (hoursMap.has(hourStr)) {
        hoursMap.set(hourStr, hoursMap.get(hourStr)! + order.totalAmount);
      }
    });

    for (const [hour, amount] of hoursMap.entries()) {
      chartsData.push({ label: hour, value: amount });
    }
  }

  // Item Rankings
  const itemCounts = new Map<string, { name: string; count: number; value: number }>();

  currentOrders.forEach(order => {
    order.items.forEach(item => {
      const existing = itemCounts.get(item.productName) || { name: item.productName, count: 0, value: 0 };
      existing.count += item.quantity;
      existing.value += (item.price * item.quantity);
      itemCounts.set(item.productName, existing);
    });
  });

  const itemsArray = Array.from(itemCounts.values());

  const mostSoldByCount = [...itemsArray].sort((a, b) => b.count - a.count).slice(0, 10);
  const mostSoldByValue = [...itemsArray].sort((a, b) => b.value - a.value).slice(0, 10);

  return {
    period: period || 'today',
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
