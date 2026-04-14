import { Router, Request, Response } from 'express';
import { apiReference } from '@scalar/express-api-reference';

const router = Router();

// ─── OpenAPI Specification ────────────────────────────────────────────────────

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Online Shop UMKM API',
    version: '1.0.0',
    description:
      'REST API for multi-tenant e-commerce platform. Supports admin authentication, product management, guest checkout, and manual payment confirmation.',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API Server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Public - Products', description: 'Public product browsing' },
    { name: 'Public - Checkout', description: 'Guest checkout flow' },
    { name: 'Admin - Store', description: 'Store management (JWT required)' },
    { name: 'Admin - Products', description: 'Product management (JWT required)' },
    { name: 'Admin - Orders', description: 'Order management (JWT required)' },
    { name: 'Admin - Shipping Drivers', description: 'Shipping driver management (JWT required)' },
    { name: 'Admin - Shipping Shifts', description: 'Shipping shift management (JWT required)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from POST /auth/login',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'integer', example: 200 },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'integer' },
          message: { type: 'string' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['identifier', 'password'],
        properties: {
          identifier: {
            type: 'string',
            description: 'Phone number or email',
            example: '628111111111',
          },
          password: { type: 'string', example: 'Admin123!' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          admin: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              role: { type: 'string', enum: ['owner', 'manager', 'staff'] },
              storeId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          storeId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          basePrice: { type: 'integer' },
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                imageUrl: { type: 'string' },
              },
            },
          },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                values: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      value: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          variants: {
            type: 'array',
            items: { $ref: '#/components/schemas/Variant' },
          },
        },
      },
      Variant: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          sku: { type: 'string', nullable: true },
          stock: { type: 'integer' },
          price: { type: 'integer' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                optionId: { type: 'string', format: 'uuid' },
                optionValueId: { type: 'string', format: 'uuid' },
                value: { type: 'string' },
              },
            },
          },
        },
      },
      CreateProductRequest: {
        type: 'object',
        required: ['name', 'basePrice'],
        properties: {
          name: { type: 'string', example: 'New Product' },
          description: { type: 'string', example: 'Product description' },
          basePrice: { type: 'integer', example: 100000 },
        },
      },
      UpdateProductRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          basePrice: { type: 'integer' },
        },
      },
      AddImageRequest: {
        type: 'object',
        required: ['imageUrl'],
        properties: {
          imageUrl: { type: 'string', example: 'https://example.com/image.jpg' },
        },
      },
      AddOptionRequest: {
        type: 'object',
        required: ['name', 'values'],
        properties: {
          name: { type: 'string', example: 'Size' },
          values: {
            type: 'array',
            items: { type: 'string' },
            example: ['S', 'M', 'L'],
          },
        },
      },
      AddVariantRequest: {
        type: 'object',
        required: ['stock', 'optionValueIds'],
        properties: {
          sku: { type: 'string', example: 'SKU-001' },
          priceOverride: { type: 'integer', nullable: true, example: 120000 },
          stock: { type: 'integer', example: 10 },
          optionValueIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
        },
      },
      CheckoutRequest: {
        type: 'object',
        required: ['storeId', 'customerPhone', 'items'],
        properties: {
          storeId: { type: 'string', format: 'uuid' },
          customerPhone: { type: 'string', example: '628123456789' },
          customerEmail: { type: 'string', example: 'customer@example.com' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string', format: 'uuid' },
                variantId: { type: 'string', format: 'uuid' },
                quantity: { type: 'integer', example: 1 },
              },
            },
          },
        },
      },
      PaymentProofRequest: {
        type: 'object',
        required: ['publicOrderId', 'imageUrl'],
        properties: {
          publicOrderId: { type: 'string', example: 'ORD-ABC123-XYZ' },
          imageUrl: { type: 'string', example: 'https://example.com/proof.jpg' },
        },
      },
      ShippingShift: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          storeId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Pagi' },
          startTime: { type: 'string', example: '08:00' },
          endTime: { type: 'string', example: '12:00' },
          isActive: { type: 'boolean', example: true },
          sortOrder: { type: 'integer', nullable: true, example: 1 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ShippingDriver: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          storeId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Pak Budi' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ShippingAssignment: {
        type: 'object',
        properties: {
          shiftId: { type: 'string', format: 'uuid' },
          deliveryDate: { type: 'string', format: 'date-time' },
          driverName: { type: 'string', example: 'Pak Budi' },
          assignedAt: { type: 'string', format: 'date-time' },
          assignedByAdminId: { type: 'string', format: 'uuid', nullable: true },
          shiftName: { type: 'string', example: 'Pagi' },
          shiftStartTime: { type: 'string', example: '08:00' },
          shiftEndTime: { type: 'string', example: '12:00' },
          shiftLabel: { type: 'string', example: 'Pagi (08:00 - 12:00)' },
        },
      },
      ShippingShiftRequest: {
        type: 'object',
        required: ['name', 'startTime', 'endTime', 'isActive'],
        properties: {
          name: { type: 'string', example: 'Pagi' },
          startTime: { type: 'string', example: '08:00' },
          endTime: { type: 'string', example: '12:00' },
          isActive: { type: 'boolean', example: true },
        },
      },
      ShippingDriverRequest: {
        type: 'object',
        required: ['name', 'isActive'],
        properties: {
          name: { type: 'string', example: 'Pak Budi' },
          isActive: { type: 'boolean', example: true },
        },
      },
      ShipOrderRequest: {
        type: 'object',
        required: ['deliveryDate', 'shiftId', 'driverName'],
        properties: {
          deliveryDate: { type: 'string', format: 'date', example: '2026-04-10' },
          shiftId: { type: 'string', format: 'uuid' },
          driverName: { type: 'string', example: 'Pak Budi' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          publicOrderId: { type: 'string' },
          status: {
            type: 'string',
            enum: [
              'pending_payment',
              'waiting_confirmation',
              'paid',
              'shipped',
              'done',
              'cancelled',
              'expired_unpaid',
            ],
          },
          totalAmount: { type: 'integer' },
          shippingCost: { type: 'integer' },
          minimumOrderApplied: { type: 'integer', nullable: true },
          freeShippingMinimumOrderApplied: { type: 'integer', nullable: true },
          isFreeShippingApplied: { type: 'boolean' },
          expiresAt: { type: 'string', format: 'date-time' },
          shippingAssignment: {
            allOf: [
              { $ref: '#/components/schemas/ShippingAssignment' },
            ],
            nullable: true,
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productName: { type: 'string' },
                variantDescription: { type: 'string', nullable: true },
                price: { type: 'integer' },
                quantity: { type: 'integer' },
              },
            },
          },
        },
      },
      Store: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          logoUrl: { type: 'string', nullable: true },
          bannerUrl: { type: 'string', nullable: true },
          footerText: { type: 'string', nullable: true },
          whatsappNumber: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true },
          bankAccountName: { type: 'string', nullable: true },
          bankAccountNumber: { type: 'string', nullable: true },
          bankName: { type: 'string', nullable: true },
          qrisImageUrl: { type: 'string', nullable: true },
          deliveryRetailMinimumOrder: { type: 'integer', nullable: true },
          deliveryStoreMinimumOrder: { type: 'integer', nullable: true },
          deliveryRetailFreeShippingMinimumOrder: { type: 'integer', nullable: true },
          deliveryStoreFreeShippingMinimumOrder: { type: 'integer', nullable: true },
        },
      },
      UpdateStoreRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          logoUrl: { type: 'string' },
          bannerUrl: { type: 'string' },
          footerText: { type: 'string' },
          whatsappNumber: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          bankAccountName: { type: 'string' },
          bankAccountNumber: { type: 'string' },
          bankName: { type: 'string' },
          qrisImageUrl: { type: 'string' },
          deliveryRetailMinimumOrder: { type: 'integer', nullable: true },
          deliveryStoreMinimumOrder: { type: 'integer', nullable: true },
          deliveryRetailFreeShippingMinimumOrder: { type: 'integer', nullable: true },
          deliveryStoreFreeShippingMinimumOrder: { type: 'integer', nullable: true },
        },
      },
    },
  },
  paths: {
    // ─── Health ─────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
        },
      },
    },

    // ─── Auth ───────────────────────────────────────────────────────────────
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Admin login',
        description: 'Authenticate with phone/email and password to receive JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/LoginResponse' },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },

    // ─── Public Products ────────────────────────────────────────────────────
    '/products': {
      get: {
        tags: ['Public - Products'],
        summary: 'List all products',
        parameters: [
          {
            name: 'storeId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by store ID',
          },
        ],
        responses: {
          200: {
            description: 'Products list',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Product' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Public - Products'],
        summary: 'Get product by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Product details',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/Product' },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },

    // ─── Public Checkout ────────────────────────────────────────────────────
    '/checkout': {
      post: {
        tags: ['Public - Checkout'],
        summary: 'Create order (guest checkout)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CheckoutRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Order created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/Order' },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/payment-proof': {
      post: {
        tags: ['Public - Checkout'],
        summary: 'Upload payment proof',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaymentProofRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Payment proof uploaded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
        },
      },
    },
    '/order/{publicOrderId}': {
      get: {
        tags: ['Public - Checkout'],
        summary: 'Get order status',
        parameters: [
          {
            name: 'publicOrderId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'ORD-ABC123-XYZ',
          },
        ],
        responses: {
          200: {
            description: 'Order details',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/Order' },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: 'Order not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },

    // ─── Admin Store ────────────────────────────────────────────────────────
    '/admin/store': {
      get: {
        tags: ['Admin - Store'],
        summary: 'Get store details',
        description: 'Requires: owner or manager role',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Store details',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/Store' },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden - Insufficient permissions' },
        },
      },
      patch: {
        tags: ['Admin - Store'],
        summary: 'Update store details',
        description: 'Requires: owner or manager role',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateStoreRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Store updated',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/Store' },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden - Insufficient permissions' },
        },
      },
    },

    // ─── Admin Products ─────────────────────────────────────────────────────
    '/admin/products': {
      get: {
        tags: ['Admin - Products'],
        summary: 'List products for current store',
        description: 'Requires: owner, manager, or staff role',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Products list',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Product' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Admin - Products'],
        summary: 'Create product',
        description: 'Requires: owner, manager, or staff role',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateProductRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Product created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/Product' },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/admin/products/{id}': {
      get: {
        tags: ['Admin - Products'],
        summary: 'Get product by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Product details' },
          401: { description: 'Unauthorized' },
          404: { description: 'Product not found' },
        },
      },
      patch: {
        tags: ['Admin - Products'],
        summary: 'Update product',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateProductRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Product updated' },
          401: { description: 'Unauthorized' },
          404: { description: 'Product not found' },
        },
      },
      delete: {
        tags: ['Admin - Products'],
        summary: 'Delete product',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Product deleted' },
          401: { description: 'Unauthorized' },
          404: { description: 'Product not found' },
        },
      },
    },
    '/admin/products/{id}/images': {
      post: {
        tags: ['Admin - Products'],
        summary: 'Add product image',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddImageRequest' },
            },
          },
        },
        responses: {
          201: { description: 'Image added' },
          401: { description: 'Unauthorized' },
          404: { description: 'Product not found' },
        },
      },
    },
    '/admin/products/{id}/options': {
      post: {
        tags: ['Admin - Products'],
        summary: 'Add product option',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddOptionRequest' },
            },
          },
        },
        responses: {
          201: { description: 'Option added' },
          401: { description: 'Unauthorized' },
          404: { description: 'Product not found' },
        },
      },
    },
    '/admin/products/{id}/variants': {
      post: {
        tags: ['Admin - Products'],
        summary: 'Add product variant',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddVariantRequest' },
            },
          },
        },
        responses: {
          201: { description: 'Variant added' },
          401: { description: 'Unauthorized' },
          404: { description: 'Product not found' },
        },
      },
    },

    // ─── Admin Orders ───────────────────────────────────────────────────────
    '/admin/orders': {
      get: {
        tags: ['Admin - Orders'],
        summary: 'List orders for current store',
        description: 'Requires: owner, manager, or staff role',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: [
                'pending_payment',
                'waiting_confirmation',
                'paid',
                'shipped',
                'done',
                'cancelled',
                'expired_unpaid',
              ],
            },
            description: 'Filter by status',
          },
        ],
        responses: {
          200: { description: 'Orders list' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/admin/orders/{id}': {
      get: {
        tags: ['Admin - Orders'],
        summary: 'Get order by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Order details' },
          401: { description: 'Unauthorized' },
          404: { description: 'Order not found' },
        },
      },
    },
    '/admin/orders/{id}/confirm': {
      patch: {
        tags: ['Admin - Orders'],
        summary: 'Confirm payment',
        description: 'Change order status from waiting_confirmation to paid',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Payment confirmed' },
          400: { description: 'Invalid order status' },
          401: { description: 'Unauthorized' },
          404: { description: 'Order not found' },
        },
      },
    },
    '/admin/orders/{id}/status': {
      patch: {
        tags: ['Admin - Orders'],
        summary: 'Update order status',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: [
                      'pending_payment',
                      'waiting_confirmation',
                      'paid',
                      'shipped',
                      'done',
                      'cancelled',
                      'expired_unpaid',
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Status updated' },
          401: { description: 'Unauthorized' },
          404: { description: 'Order not found' },
        },
      },
    },
    '/admin/orders/{id}/ship': {
      patch: {
        tags: ['Admin - Orders'],
        summary: 'Schedule and ship a delivery order',
        description: 'Assign delivery date, shift, and driver to a paid delivery order and mark it as shipped',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ShipOrderRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Order shipping scheduled' },
          400: { description: 'Invalid delivery order state or payload' },
          401: { description: 'Unauthorized' },
          404: { description: 'Order or shift not found' },
        },
      },
    },
    '/admin/shipping-shifts': {
      get: {
        tags: ['Admin - Shipping Shifts'],
        summary: 'List shipping shifts for current store',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Shipping shifts list' },
          401: { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Admin - Shipping Shifts'],
        summary: 'Create shipping shift',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ShippingShiftRequest' },
            },
          },
        },
        responses: {
          201: { description: 'Shipping shift created' },
          400: { description: 'Invalid payload' },
          401: { description: 'Unauthorized' },
          409: { description: 'Duplicate shift' },
        },
      },
    },
    '/admin/shipping-drivers': {
      get: {
        tags: ['Admin - Shipping Drivers'],
        summary: 'List shipping drivers for current store',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Shipping drivers list' },
          401: { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Admin - Shipping Drivers'],
        summary: 'Create shipping driver',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ShippingDriverRequest' },
            },
          },
        },
        responses: {
          201: { description: 'Shipping driver created' },
          400: { description: 'Invalid payload' },
          401: { description: 'Unauthorized' },
          409: { description: 'Duplicate driver' },
        },
      },
    },
    '/admin/shipping-drivers/{id}': {
      patch: {
        tags: ['Admin - Shipping Drivers'],
        summary: 'Update shipping driver',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ShippingDriverRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Shipping driver updated' },
          400: { description: 'Invalid payload' },
          401: { description: 'Unauthorized' },
          404: { description: 'Shipping driver not found' },
          409: { description: 'Duplicate driver' },
        },
      },
      delete: {
        tags: ['Admin - Shipping Drivers'],
        summary: 'Delete shipping driver',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Shipping driver deleted' },
          401: { description: 'Unauthorized' },
          404: { description: 'Shipping driver not found' },
        },
      },
    },
    '/admin/shipping-shifts/{id}': {
      patch: {
        tags: ['Admin - Shipping Shifts'],
        summary: 'Update shipping shift',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ShippingShiftRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Shipping shift updated' },
          400: { description: 'Invalid payload' },
          401: { description: 'Unauthorized' },
          404: { description: 'Shipping shift not found' },
          409: { description: 'Duplicate shift' },
        },
      },
      delete: {
        tags: ['Admin - Shipping Shifts'],
        summary: 'Delete shipping shift',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Shipping shift deleted' },
          400: { description: 'Shipping shift is already used' },
          401: { description: 'Unauthorized' },
          404: { description: 'Shipping shift not found' },
        },
      },
    },
  },
};

// ─── Serve OpenAPI JSON ───────────────────────────────────────────────────────

router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// ─── Serve Scalar Documentation UI ────────────────────────────────────────────

router.use(
  '/docs',
  apiReference({
    spec: {
      content: openApiSpec,
    },
    theme: 'purple',
    layout: 'modern',
    defaultHttpClient: {
      targetKey: 'javascript',
      clientKey: 'fetch',
    },
    authentication: {
      preferredSecurityScheme: 'bearerAuth',
    },
  }),
);

export default router;
