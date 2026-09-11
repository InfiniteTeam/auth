/**
 * API module — versioned REST controllers under `/api/v1`.
 */

import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { SessionController } from "./session.controller.js";
import { AccountController } from "./account.controller.js";
import { AccountService } from "./account.service.js";
import { AdminModule } from "./admin/admin.module.js";
import { LldapModule } from "../lldap/lldap.module.js";
import { SessionModule } from "../session/session.module.js";
import { SocialModule } from "../social/social.module.js";

@Module({
  imports: [LldapModule, SessionModule, AdminModule, SocialModule],
  controllers: [AuthController, SessionController, AccountController],
  providers: [AccountService],
})
export class ApiModule {}
