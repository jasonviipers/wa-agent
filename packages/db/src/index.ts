import dotenv from "dotenv";

dotenv.config({
  path: "../../apps/web/.env",
});

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const client = new Pool({
  connectionString: process.env.DATABASE_URL as string,
});

export const db = drizzle({ client, schema });
export { and, desc, eq, like, sql, exists, count, inArray, cosineDistance, gt, or } from "drizzle-orm";

