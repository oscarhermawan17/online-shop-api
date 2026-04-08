import { Client } from 'pg';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

type StoreScopedTable =
  | 'customers'
  | 'order_items'
  | 'payment_proofs'
  | 'product_images'
  | 'product_options'
  | 'product_option_values'
  | 'variants';

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const res = await client.query<{ table_name: string | null }>(
    `SELECT to_regclass($1) AS table_name`,
    [`public.${tableName}`]
  );

  return Boolean(res.rows[0]?.table_name);
}

async function columnExists(
  client: Client,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const res = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS "exists"
    `,
    [tableName, columnName]
  );

  return Boolean(res.rows[0]?.exists);
}

async function getOrCreateDefaultStoreId(client: Client): Promise<string> {
  const hasStoresTable = await tableExists(client, 'stores');
  if (!hasStoresTable) {
    throw new Error(
      'Table "stores" was not found. Please ensure Store model is present and schema is pushed at least once.'
    );
  }

  const existing = await client.query<{ id: string }>(
    `SELECT id FROM "stores" ORDER BY "createdAt" ASC LIMIT 1`
  );

  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const storeId = randomUUID();
  await client.query(
    `
      INSERT INTO "stores" ("id", "name", "createdAt", "updatedAt")
      VALUES ($1, 'Default Store', NOW(), NOW())
    `,
    [storeId]
  );

  console.log('🧩 Created fallback store row for legacy data backfill.');
  return storeId;
}

async function ensureLegacyStoreIdColumns(client: Client): Promise<void> {
  const tables: StoreScopedTable[] = [
    'customers',
    'order_items',
    'payment_proofs',
    'product_images',
    'product_options',
    'product_option_values',
    'variants',
  ];

  for (const tableName of tables) {
    const hasTable = await tableExists(client, tableName);
    if (!hasTable) continue;

    const hasStoreId = await columnExists(client, tableName, 'storeId');
    if (hasStoreId) continue;

    await client.query(`ALTER TABLE "${tableName}" ADD COLUMN "storeId" TEXT`);
    console.log(`🛠️ Added temporary nullable column "${tableName}.storeId"`);
  }
}

async function backfillLegacyStoreIdValues(client: Client): Promise<void> {
  const fallbackStoreId = await getOrCreateDefaultStoreId(client);

  if (
    (await tableExists(client, 'customers')) &&
    (await tableExists(client, 'orders')) &&
    (await columnExists(client, 'customers', 'storeId')) &&
    (await columnExists(client, 'orders', 'storeId'))
  ) {
    await client.query(`
      UPDATE "customers" AS c
      SET "storeId" = src.store_id
      FROM (
        SELECT "customerId", MIN("storeId") AS store_id
        FROM "orders"
        GROUP BY "customerId"
      ) AS src
      WHERE c.id = src."customerId"
        AND c."storeId" IS NULL
    `);
  }

  if (
    (await tableExists(client, 'order_items')) &&
    (await tableExists(client, 'orders')) &&
    (await columnExists(client, 'order_items', 'storeId')) &&
    (await columnExists(client, 'orders', 'storeId'))
  ) {
    await client.query(`
      UPDATE "order_items" AS oi
      SET "storeId" = o."storeId"
      FROM "orders" AS o
      WHERE oi."orderId" = o.id
        AND oi."storeId" IS NULL
    `);
  }

  if (
    (await tableExists(client, 'payment_proofs')) &&
    (await tableExists(client, 'orders')) &&
    (await columnExists(client, 'payment_proofs', 'storeId')) &&
    (await columnExists(client, 'orders', 'storeId'))
  ) {
    await client.query(`
      UPDATE "payment_proofs" AS pp
      SET "storeId" = o."storeId"
      FROM "orders" AS o
      WHERE pp."orderId" = o.id
        AND pp."storeId" IS NULL
    `);
  }

  if (
    (await tableExists(client, 'product_images')) &&
    (await tableExists(client, 'products')) &&
    (await columnExists(client, 'product_images', 'storeId')) &&
    (await columnExists(client, 'products', 'storeId'))
  ) {
    await client.query(`
      UPDATE "product_images" AS pi
      SET "storeId" = p."storeId"
      FROM "products" AS p
      WHERE pi."productId" = p.id
        AND pi."storeId" IS NULL
    `);
  }

  if (
    (await tableExists(client, 'product_options')) &&
    (await tableExists(client, 'products')) &&
    (await columnExists(client, 'product_options', 'storeId')) &&
    (await columnExists(client, 'products', 'storeId'))
  ) {
    await client.query(`
      UPDATE "product_options" AS po
      SET "storeId" = p."storeId"
      FROM "products" AS p
      WHERE po."productId" = p.id
        AND po."storeId" IS NULL
    `);
  }

  if (
    (await tableExists(client, 'product_option_values')) &&
    (await tableExists(client, 'product_options')) &&
    (await columnExists(client, 'product_option_values', 'storeId')) &&
    (await columnExists(client, 'product_options', 'storeId'))
  ) {
    await client.query(`
      UPDATE "product_option_values" AS pov
      SET "storeId" = po."storeId"
      FROM "product_options" AS po
      WHERE pov."optionId" = po.id
        AND pov."storeId" IS NULL
    `);
  }

  if (
    (await tableExists(client, 'variants')) &&
    (await tableExists(client, 'products')) &&
    (await columnExists(client, 'variants', 'storeId')) &&
    (await columnExists(client, 'products', 'storeId'))
  ) {
    await client.query(`
      UPDATE "variants" AS v
      SET "storeId" = p."storeId"
      FROM "products" AS p
      WHERE v."productId" = p.id
        AND v."storeId" IS NULL
    `);
  }

  const tables: StoreScopedTable[] = [
    'customers',
    'order_items',
    'payment_proofs',
    'product_images',
    'product_options',
    'product_option_values',
    'variants',
  ];

  for (const tableName of tables) {
    const hasTable = await tableExists(client, tableName);
    if (!hasTable) continue;

    const hasStoreId = await columnExists(client, tableName, 'storeId');
    if (!hasStoreId) continue;

    await client.query(
      `UPDATE "${tableName}" SET "storeId" = $1 WHERE "storeId" IS NULL`,
      [fallbackStoreId]
    );
  }
}

async function reconcileDuplicateCustomers(client: Client): Promise<void> {
  const hasCustomersTable = await tableExists(client, 'customers');
  if (!hasCustomersTable) return;

  const hasStoreId = await columnExists(client, 'customers', 'storeId');
  if (!hasStoreId) return;

  const duplicates = await client.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM (
      SELECT "storeId", "phone"
      FROM "customers"
      GROUP BY "storeId", "phone"
      HAVING COUNT(*) > 1
    ) grouped_duplicates
  `);

  const duplicateGroups = Number(duplicates.rows[0]?.count ?? '0');
  if (duplicateGroups === 0) return;

  console.log(
    `🧹 Found ${duplicateGroups} duplicate customer group(s) on (storeId, phone). Reconciling...`
  );

  await client.query(`
    WITH ranked AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY "storeId", "phone"
          ORDER BY "createdAt" ASC, id ASC
        ) AS keeper_id,
        ROW_NUMBER() OVER (
          PARTITION BY "storeId", "phone"
          ORDER BY "createdAt" ASC, id ASC
        ) AS rn
      FROM "customers"
    ),
    dupes AS (
      SELECT id, keeper_id
      FROM ranked
      WHERE rn > 1
    )
    UPDATE "orders" AS o
    SET "customerId" = dupes.keeper_id
    FROM dupes
    WHERE o."customerId" = dupes.id
  `);

  await client.query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY "storeId", "phone"
          ORDER BY "createdAt" ASC, id ASC
        ) AS rn
      FROM "customers"
    )
    DELETE FROM "customers" AS c
    USING ranked
    WHERE c.id = ranked.id
      AND ranked.rn > 1
  `);
}

/**
 * Automatically creates the PostgreSQL database if it doesn't exist.
 * Then runs Prisma migrations to ensure the table schema is ready.
 */
export async function ensureDatabaseExists(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('❌ DATABASE_URL is not defined in .env');
  }

  // Parse DATABASE_URL
  // Expected format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
  const urlParts = new URL(databaseUrl);
  const targetDb = urlParts.pathname.slice(1); // Remove leading slash
  if (!targetDb) {
    throw new Error('❌ DATABASE_URL is missing the target database name');
  }

  // Create a connection string for the default 'postgres' database
  // to check/create the target database.
  const baseParts = new URL(databaseUrl);
  baseParts.pathname = '/postgres';
  const baseConnectionString = baseParts.toString();

  const client = new Client({
    connectionString: baseConnectionString,
  });

  try {
    await client.connect();
    console.log(`🔍 Checking if database "${targetDb}" exists...`);

    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb]
    );

    if (res.rowCount === 0) {
      console.log(`✨ Database "${targetDb}" not found. Creating it now...`);
      // CREATE DATABASE cannot be run in a transaction, and Client handles this
      await client.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`✅ Database "${targetDb}" created successfully.`);
    } else {
      console.log(`✅ Database "${targetDb}" already exists.`);
    }
  } catch (error: any) {
    console.error('❌ Error during database initialization:', error.message);
    throw error;
  } finally {
    await client.end();
  }

  // Run Prisma migrations after ensuring the DB exists
  try {
    console.log('🏗️  Running Prisma migrations/push to ensure tables are ready...');
    // We use `prisma db push` for development speed, or `prisma migrate deploy` for prod
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
      const targetClient = new Client({ connectionString: databaseUrl });
      await targetClient.connect();

      try {
        console.log('🧹 Backfilling legacy rows for newly required storeId columns...');
        await ensureLegacyStoreIdColumns(targetClient);
        await backfillLegacyStoreIdValues(targetClient);
        await reconcileDuplicateCustomers(targetClient);
      } finally {
        await targetClient.end();
      }
    }

    const prismaCommand = isDev
      ? 'npx prisma db push --accept-data-loss'
      : 'npx prisma migrate deploy';
    
    execSync(prismaCommand, { stdio: 'inherit' });
    console.log('✅ Table schema is up to date.');
  } catch (error: any) {
    console.error('❌ Error during schema initialization:', error.message);
    throw error;
  }
}

// Allow running as a standalone script
if (require.main === module) {
  ensureDatabaseExists()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
