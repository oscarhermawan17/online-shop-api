const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  try {
    const data = {
      admins: await p.admin.count(),
      customers: await p.customer.count(),
      categories: await p.category.count(),
      units: await p.unit.count(),
      stores: await p.store.count(),
      orders: await p.order.count(),
      orderItems: await p.orderItem.count(),
      paymentProofs: await p.paymentProof.count(),
      creditPayments: await p.creditPayment.count(),
      stockMovements: await p.stockMovement.count(),
      shippingZones: await p.shippingZone.count(),
      shippingDrivers: await p.shippingDriver.count(),
      shippingShifts: await p.shippingShift.count(),
      carouselSlides: await p.carouselSlide.count(),
      productDiscounts: await p.productDiscount.count(),
      variants: await p.variant.count(),
      products: await p.product.count()
    };
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await p.$disconnect();
    process.exit(0);
  }
}
run();
