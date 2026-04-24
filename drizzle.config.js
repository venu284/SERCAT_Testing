import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { getRequiredDatabaseUrl } from './lib/env.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

export default defineConfig({
  schema: './db/schema/*',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: getRequiredDatabaseUrl(),
  },
});
