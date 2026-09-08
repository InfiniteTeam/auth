/**
 * Session module — DB-backed sessions and the signed `inft_session` cookie.
 */

import { Module } from "@nestjs/common";
import { SessionService } from "./session.service.js";
import { SessionGuard, SessionResolver } from "./session.guard.js";

@Module({
  providers: [SessionService, SessionGuard, SessionResolver],
  exports: [SessionService, SessionGuard, SessionResolver],
})
export class SessionModule {}
