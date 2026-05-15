import { Router } from "express"

import { requireAuth } from "../../../middlewares/auth.middleware"
import * as notificationsController from "./notifications.controller"

const router = Router()

router.use(requireAuth)

router.get("/", notificationsController.getNotifications)
router.patch("/read-all", notificationsController.markAllRead)

export default router
