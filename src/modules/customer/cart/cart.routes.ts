import { Router } from "express"

import { requireCustomerAuth } from "../../../middlewares/customer-auth.middleware"
import * as cartController from "./cart.controller"

const router = Router()

router.use(requireCustomerAuth)

// GET /customer/cart — get cart items
router.get("/", cartController.getCart)

// POST /customer/cart — add item to cart
router.post("/", cartController.addItem)

// POST /customer/cart/merge — merge guest cart into server cart
router.post("/merge", cartController.mergeCart)

// PUT /customer/cart/:productId/:variantId — set quantity
router.put("/:productId/:variantId", cartController.setQuantity)

// DELETE /customer/cart/:productId/:variantId — remove item
router.delete("/:productId/:variantId", cartController.removeItem)

// DELETE /customer/cart — clear entire cart
router.delete("/", cartController.clearCart)

export default router
