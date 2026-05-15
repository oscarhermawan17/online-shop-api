import { Response, NextFunction } from "express"

import { sendSuccess } from "../../../utils/response"
import { AuthRequest } from "../../../middlewares/auth.middleware"
import * as notificationsService from "./notifications.service"

export const getNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const data = await notificationsService.getNotifications(storeId, page)
    sendSuccess(res, data, "Notifications fetched successfully", 200)
  } catch (error) {
    next(error)
  }
}

export const markAllRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId
    await notificationsService.markAllRead(storeId)
    sendSuccess(res, null, "Notifications marked as read", 200)
  } catch (error) {
    next(error)
  }
}
