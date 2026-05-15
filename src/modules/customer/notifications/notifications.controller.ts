import { Response, NextFunction } from "express"

import { sendSuccess } from "../../../utils/response"
import { CustomerAuthRequest } from "../../../middlewares/customer-auth.middleware"
import * as notificationsService from "./notifications.service"

export const getMyNotifications = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const customerId = req.customer!.customerId
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const data = await notificationsService.getMyNotifications(customerId, page)
    sendSuccess(res, data, "Notifications fetched successfully", 200)
  } catch (error) {
    next(error)
  }
}

export const markAllRead = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const customerId = req.customer!.customerId
    await notificationsService.markAllRead(customerId)
    sendSuccess(res, null, "Notifications marked as read", 200)
  } catch (error) {
    next(error)
  }
}
