/**
 * Admin module — platform management under `/api/v1/admin`.
 */

import { Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/config.js";
import { SessionModule } from "../../session/session.module.js";
import { LldapModule } from "../../lldap/lldap.module.js";
import { PermissionsGuard } from "../../session/permissions.guard.js";
import { SnowflakeGenerator } from "../../common/snowflake.js";
import { AdminClientsService, SNOWFLAKE } from "./admin-clients.service.js";
import { AdminClientsController } from "./admin-clients.controller.js";
import { AdminUsersService } from "./admin-users.service.js";
import { AdminUsersController } from "./admin-users.controller.js";
import { AdminGroupsService } from "./admin-groups.service.js";
import { AdminGroupsController } from "./admin-groups.controller.js";
import { AdminSessionsService } from "./admin-sessions.service.js";
import { AdminSessionsController } from "./admin-sessions.controller.js";
import { AdminSettingsService } from "./admin-settings.service.js";
import { AdminSettingsController } from "./admin-settings.controller.js";

@Module({
  imports: [SessionModule, LldapModule],
  controllers: [
    AdminClientsController,
    AdminUsersController,
    AdminGroupsController,
    AdminSessionsController,
    AdminSettingsController,
  ],
  providers: [
    AdminClientsService,
    AdminUsersService,
    AdminGroupsService,
    AdminSessionsService,
    AdminSettingsService,
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