import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as productsController from './products.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// All product management routes require at least staff role
router.use(requireRole('staff'));

// ─── Product CRUD ─────────────────────────────────────────────────────────────

router.get('/', productsController.listProducts);
router.get('/export/inventory', productsController.exportInventory);
router.get('/:id', productsController.getProduct);
router.post('/', productsController.createProduct);
router.patch('/:id', productsController.updateProduct);
router.delete('/:id', productsController.deleteProduct);

// ─── Product Images ───────────────────────────────────────────────────────────

router.post('/:id/images', productsController.addProductImage);
router.delete('/:id/images/:imageId', productsController.deleteProductImage);

// ─── Product Options ──────────────────────────────────────────────────────────

router.post('/:id/options', productsController.addProductOption);
router.delete('/:id/options/:optionId', productsController.deleteProductOption);

// ─── Product Variants ─────────────────────────────────────────────────────────

router.post('/:id/variants', productsController.addProductVariant);
router.patch('/:id/variants/:variantId', productsController.updateProductVariant);
router.delete('/:id/variants/:variantId', productsController.deleteProductVariant);

// ─── Variant Discount Rules ───────────────────────────────────────────────────

router.get('/:id/variants/:variantId/discount-rules', productsController.listVariantDiscountRules);
router.post('/:id/variants/:variantId/discount-rules', productsController.createVariantDiscountRule);
router.patch('/:id/variants/:variantId/discount-rules/:ruleId', productsController.updateVariantDiscountRule);
router.delete('/:id/variants/:variantId/discount-rules/:ruleId', productsController.deleteVariantDiscountRule);

// ─── Product Discount Rules (apply to all variants) ──────────────────────────

router.get('/:id/discount-rules', productsController.listProductDiscountRules);
router.post('/:id/discount-rules', productsController.createProductDiscountRule);
router.patch('/:id/discount-rules/:ruleId', productsController.updateProductDiscountRule);
router.delete('/:id/discount-rules/:ruleId', productsController.deleteProductDiscountRule);

// ─── Product Discount (legacy) ───────────────────────────────────────────────

router.put('/:id/discount', productsController.upsertDiscount);

export default router;
