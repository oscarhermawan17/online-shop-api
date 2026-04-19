import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import { sendXls } from '../../../utils/xls';
import * as productsService from './products.service';

type SortField = 'name' | 'category' | 'basePrice' | 'wholesalePrice' | 'variants' | 'stock' | 'status';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'inactive';

type ProductListItem = Awaited<ReturnType<typeof productsService.listProducts>>[number];

const readQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
};

const parseOptionalNumber = (value: unknown): number | undefined => {
  const raw = readQueryString(value);

  if (!raw || raw.trim() === '') {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const getSellableVariants = (product: ProductListItem) => {
  const realVariants = product.variants.filter((variant) => !variant.isDefault);
  return realVariants.length > 0 ? realVariants : product.variants;
};

const getTotalStock = (product: ProductListItem) => {
  const sellableVariants = getSellableVariants(product);
  return sellableVariants.length > 0
    ? sellableVariants.reduce((sum, variant) => sum + variant.stock, 0)
    : product.stock;
};

const toIsoDateTime = (value: Date): string => value.toISOString().replace('T', ' ').slice(0, 19);

// ─── GET /admin/products ──────────────────────────────────────────────────────

export const listProducts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const products = await productsService.listProducts(req.user!.storeId);
    sendSuccess(res, products, 'Products fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/products/export/inventory ─────────────────────────────────────

export const exportInventory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const products = await productsService.listProducts(req.user!.storeId);

    const nameFilter = (readQueryString(req.query.name) || '').trim().toLowerCase();
    const categoryIdFilter = readQueryString(req.query.categoryId) || 'all';
    const normalPriceMin = parseOptionalNumber(req.query.normalPriceMin);
    const retailPriceMin = parseOptionalNumber(req.query.retailPriceMin);
    const variantMin = parseOptionalNumber(req.query.variantMin);
    const stockMin = parseOptionalNumber(req.query.stockMin);

    const statusQuery = readQueryString(req.query.status);
    const statusFilter: StatusFilter =
      statusQuery === 'active' || statusQuery === 'inactive' ? statusQuery : 'all';

    const sortFieldQuery = readQueryString(req.query.sortField);
    const sortDirectionQuery = readQueryString(req.query.sortDirection);

    const sortField: SortField =
      sortFieldQuery === 'category'
      || sortFieldQuery === 'basePrice'
      || sortFieldQuery === 'wholesalePrice'
      || sortFieldQuery === 'variants'
      || sortFieldQuery === 'stock'
      || sortFieldQuery === 'status'
        ? sortFieldQuery
        : 'name';

    const sortDirection: SortDirection = sortDirectionQuery === 'desc' ? 'desc' : 'asc';

    const filteredProducts = products.filter((product) => {
      if (nameFilter && !product.name.toLowerCase().includes(nameFilter)) {
        return false;
      }

      if (categoryIdFilter !== 'all') {
        const hasCategory = product.categories.some((category) => category.id === categoryIdFilter);
        if (!hasCategory) {
          return false;
        }
      }

      if (normalPriceMin !== undefined && product.basePrice < normalPriceMin) {
        return false;
      }

      if (retailPriceMin !== undefined) {
        if (!product.wholesalePrice || product.wholesalePrice < retailPriceMin) {
          return false;
        }
      }

      if (variantMin !== undefined && getSellableVariants(product).length < variantMin) {
        return false;
      }

      if (stockMin !== undefined && getTotalStock(product) < stockMin) {
        return false;
      }

      if (statusFilter === 'active' && !product.isActive) {
        return false;
      }

      if (statusFilter === 'inactive' && product.isActive) {
        return false;
      }

      return true;
    });

    const sortedProducts = [...filteredProducts].sort((a, b) => {
      const getSortValue = (product: ProductListItem): string | number => {
        switch (sortField) {
          case 'name':
            return product.name.toLowerCase();
          case 'category':
            return product.categories
              .map((category) => category.name)
              .sort((x, y) => x.localeCompare(y))
              .join(', ')
              .toLowerCase();
          case 'basePrice':
            return product.basePrice;
          case 'wholesalePrice':
            return product.wholesalePrice ?? -1;
          case 'variants':
            return getSellableVariants(product).length;
          case 'stock':
            return getTotalStock(product);
          case 'status':
            return product.isActive ? 1 : 0;
          default:
            return product.name.toLowerCase();
        }
      };

      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      let result = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        result = aValue - bValue;
      } else {
        result = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === 'asc' ? result : -result;
    });

    const totalStock = sortedProducts.reduce((sum, product) => sum + getTotalStock(product), 0);

    sendXls(res, {
      filename: `inventory-report-${new Date().toISOString().slice(0, 10)}.xls`,
      sheetName: 'Inventory Report',
      table: {
        title: 'Laporan Stok / Inventory Produk',
        subtitle: 'Data mengikuti filter tabel produk pada halaman admin.',
        metadata: [
          { label: 'Keyword Nama', value: nameFilter || '-' },
          { label: 'Kategori', value: categoryIdFilter === 'all' ? 'Semua' : categoryIdFilter },
          { label: 'Min Harga Normal', value: normalPriceMin ?? '-' },
          { label: 'Min Harga Retail', value: retailPriceMin ?? '-' },
          { label: 'Min Varian', value: variantMin ?? '-' },
          { label: 'Min Stok', value: stockMin ?? '-' },
          { label: 'Status', value: statusFilter },
          { label: 'Sort', value: `${sortField} (${sortDirection})` },
          { label: 'Jumlah Produk', value: sortedProducts.length },
          { label: 'Total Stok (produk terfilter)', value: totalStock },
          { label: 'Generated At', value: toIsoDateTime(new Date()) },
        ],
        headers: [
          'Nama Produk',
          'Kategori',
          'Harga Normal',
          'Harga Retail',
          'Jumlah Varian',
          'Total Stok',
          'Status',
          'Dibuat',
        ],
        rows: sortedProducts.map((product) => {
          const categoryLabel = product.categories.length > 0
            ? product.categories.map((category) => category.name).join(', ')
            : '-';

          return [
            product.name,
            categoryLabel,
            product.basePrice,
            product.wholesalePrice ?? '-',
            getSellableVariants(product).length,
            getTotalStock(product),
            product.isActive ? 'AKTIF' : 'NONAKTIF',
            toIsoDateTime(new Date(product.createdAt)),
          ];
        }),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/products/:id ──────────────────────────────────────────────────

export const getProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const product = await productsService.getProduct(
      req.user!.storeId,
      req.params.id as string,
    );
    sendSuccess(res, product, 'Product fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── POST /admin/products ─────────────────────────────────────────────────────

export const createProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const product = await productsService.createProduct(req.user!.storeId, req.body);
    sendSuccess(res, product, 'Product created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/products/:id ────────────────────────────────────────────────

export const updateProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const product = await productsService.updateProduct(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, product, 'Product updated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/products/:id ───────────────────────────────────────────────

export const deleteProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await productsService.deleteProduct(req.user!.storeId, req.params.id as string);
    sendSuccess(res, null, 'Product deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── POST /admin/products/:id/images ──────────────────────────────────────────

export const addProductImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const image = await productsService.addProductImage(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, image, 'Image added successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/products/:id/images/:imageId ───────────────────────────────

export const deleteProductImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await productsService.deleteProductImage(
      req.user!.storeId,
      req.params.id as string,
      req.params.imageId as string,
    );
    sendSuccess(res, null, 'Image deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── POST /admin/products/:id/options ─────────────────────────────────────────

export const addProductOption = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const option = await productsService.addProductOption(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, option, 'Option added successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/products/:id/options/:optionId ─────────────────────────────

export const deleteProductOption = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await productsService.deleteProductOption(
      req.user!.storeId,
      req.params.id as string,
      req.params.optionId as string,
    );
    sendSuccess(res, null, 'Option deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── POST /admin/products/:id/variants ────────────────────────────────────────

export const addProductVariant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const variant = await productsService.addProductVariant(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, variant, 'Variant added successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/products/:id/variants/:variantId ────────────────────────────

export const updateProductVariant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const variant = await productsService.updateProductVariant(
      req.user!.storeId,
      req.params.id as string,
      req.params.variantId as string,
      req.body,
    );
    sendSuccess(res, variant, 'Variant updated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── PUT /admin/products/:id/discount ────────────────────────────────────────

export const upsertDiscount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const discount = await productsService.upsertDiscount(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, discount, 'Discount updated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/products/:id/variants/:variantId ───────────────────────────

export const deleteProductVariant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await productsService.deleteProductVariant(
      req.user!.storeId,
      req.params.id as string,
      req.params.variantId as string,
    );
    sendSuccess(res, null, 'Variant deleted successfully');
  } catch (error) {
    next(error);
  }
};
