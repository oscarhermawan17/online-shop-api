import { Router } from "express"

import { requireCustomerAuth } from "../../../middlewares/customer-auth.middleware"
import * as notificationsController from "./notifications.controller"

const router = Router()

router.use(requireCustomerAuth)

router.get("/", notificationsController.getMyNotifications)
router.patch("/read-all", notificationsController.markAllRead)

export default router
