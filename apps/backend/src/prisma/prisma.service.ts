/**
 * Prisma service backed by the PostgreSQL `auth` database via the `pg`
 * driver adapter. Exposed globally so every consumer shares one client.
 */

import { Inject, Injectable } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import type { AppConfig } from "../config/config.js";
import { APP_CONFIG } from "../config/config.js";

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({
      adapter: new PrismaPg({ connectionString: config.databaseUrl }),
    });
  }
}
