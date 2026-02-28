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
          expiresAt: { type: 'string', format: 'date-time' },
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
