/**
 * Admin module — OIDC client management under `/api/v1/admin`.
 */

import { Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/config.js";
import { SessionModule } from "../../session/session.module.js";
import { PermissionsGuard } from "../../session/permissions.guard.js";
import { SnowflakeGenerator } from "../../common/snowflake.js";
import { AdminClientsService, SNOWFLAKE } from "./admin-clients.service.js";
import { AdminClientsController } from "./admin-clients.controller.js";

@Module({
  imports: [SessionModule],
  controllers: [AdminClientsController],
  providers: [
    AdminClientsService,
    PermissionsGuard,
    {
      provide: SNOWFLAKE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new SnowflakeGenerator({
          workerId: config.snowflakeWorkerId,
          epoch: config.snowflakeEpochMs,
        }),
    },
  ],
})
export class AdminModule {}