import { Response, NextFunction } from "express"

import { sendSuccess, sendPaginatedSuccess } from "../../../utils/response"
import * as customersService from "./customers.service"
import { AuthRequest } from "../../../middlewares/auth.middleware"
import { CustomerType } from '@prisma/client';

import { AppError } from '../../../middlewares/error.middleware';

export const getCustomers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10))
    const limit = [25, 50, 100].includes(Number(req.query.limit))
      ? Number(req.query.limit)
      : 25
    const search =
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : undefined
    const status = ["active", "inactive"].includes(String(req.query.status))
      ? (req.query.status as "active" | "inactive")
      : undefined

    const { customers, total } = await customersService.listCustomers({
      storeId,
      page,
      limit,
      search,
      status,
    })
    const totalPages = Math.ceil(total / limit)

    sendPaginatedSuccess(
      res,
      customers,
      { page, limit, total, totalPages },
      "Customers retrieved successfully",
    )
  } catch (error) {
    next(error)
  }
}

export const createCustomer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { name, phone, email, password, type } = req.body;
    const customer = await customersService.createCustomer({
      storeId,
      name,
      phone,
      email,
      password,
      type,
    });
    sendSuccess(res, customer, 'Customer created successfully', 201);
  } catch (error) {
    next(error)
  }
}

export const toggleStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId
    const { id } = req.params as { id: string }
    const result = await customersService.toggleCustomerStatus(id, storeId)
    sendSuccess(res, result, "Customer status updated successfully")
  } catch (error) {
    next(error)
  }
};

export const updateType = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { id } = req.params as { id: string };
    const { type } = req.body as { type?: CustomerType };

    if (type !== 'base' && type !== 'wholesale') {
      throw new AppError('Invalid customer type', 400);
    }

    const result = await customersService.updateCustomerType(id, storeId, type);
    sendSuccess(res, result, 'Customer type updated successfully');
  } catch (error) {
    next(error);
  }
};
