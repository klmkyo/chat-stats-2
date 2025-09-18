import type { Config } from 'drizzle-kit';

export default {
  schema: './src/features/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;