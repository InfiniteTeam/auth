/**
 * lldap module — provides the {@link LldapService}.
 */

import { Module } from "@nestjs/common";
import { LldapService } from "./lldap.service.js";

@Module({
  providers: [LldapService],
  exports: [LldapService],
})
export class LldapModule {}
