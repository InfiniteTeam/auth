/**
 * API module — versioned REST controllers under `/api/v1`.
 */

import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { SessionController } from "./session.controller.js";
import { LldapModule } from "../lldap/lldap.module.js";
import { SessionModule } from "../session/session.module.js";

@Module({
  imports: [LldapModule, SessionModule],
  controllers: [AuthController, SessionController],
})
export class ApiModule {}
