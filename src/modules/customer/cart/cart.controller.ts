import { Response, NextFunction } from "express"

import { sendSuccess } from "../../../utils/response"
import { CustomerAuthRequest } from "../../../middlewares/customer-auth.middleware"
import { AppError } from "../../../middlewares/error.middleware"
import * as cartService from "./cart.service"

// ─── GET /customer/cart ─────────────────────────────────────────────────────

export const getCart = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customerId, storeId } = req.customer!
    const items = await cartService.getCart(customerId, storeId)
    sendSuccess(res, items, "Cart fetched successfully")
  } catch (error) {
    next(error)
  }
}

// ─── POST /customer/cart ────────────────────────────────────────────────────

export const addItem = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customerId, storeId } = req.customer!
    const { productId, variantId, quantity } = req.body

    if (!productId || !variantId) {
      throw new AppError("productId and variantId are required", 400)
    }

    const item = await cartService.addItem(customerId, storeId, {
      productId,
      variantId,
      quantity: quantity ?? 1,
    })

    sendSuccess(res, item, "Item added to cart", 201)
  } catch (error) {
    next(error)
  }
}

// ─── PUT /customer/cart/:productId/:variantId ───────────────────────────────

export const setQuantity = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customerId, storeId } = req.customer!
    const { productId, variantId } = req.params as {
      productId: string
      variantId: string
    }
    const { quantity } = req.body

    if (typeof quantity !== "number") {
      throw new AppError("quantity is required", 400)
    }

    const item = await cartService.setQuantity(
      customerId,
      storeId,
      productId,
      variantId,
      quantity,
    )

    sendSuccess(
      res,
      item,
      quantity <= 0 ? "Item removed from cart" : "Cart updated",
    )
  } catch (error) {
    next(error)
  }
}

// ─── DELETE /customer/cart/:productId/:variantId ────────────────────────────

export const removeItem = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customerId } = req.customer!
    const { productId, variantId } = req.params as {
      productId: string
      variantId: string
    }

    await cartService.removeItem(customerId, productId, variantId)
    sendSuccess(res, null, "Item removed from cart")
  } catch (error) {
    next(error)
  }
}

// ─── DELETE /customer/cart ──────────────────────────────────────────────────

export const clearCart = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customerId, storeId } = req.customer!
    await cartService.clearCart(customerId, storeId)
    sendSuccess(res, null, "Cart cleared")
  } catch (error) {
    next(error)
  }
}

// ─── POST /customer/cart/merge ──────────────────────────────────────────────

export const mergeCart = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customerId, storeId } = req.customer!
    const { items } = req.body

    if (!Array.isArray(items)) {
      throw new AppError("items array is required", 400)
    }

    const merged = await cartService.mergeCart(customerId, storeId, items)
    sendSuccess(res, merged, "Cart merged successfully")
  } catch (error) {
    next(error)
  }
}
