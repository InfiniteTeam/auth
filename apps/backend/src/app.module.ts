/**
 * Root application module.
 */

import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { LldapModule } from "./lldap/lldap.module.js";
import { SessionModule } from "./session/session.module.js";
import { ApiModule } from "./api/api.module.js";
import { WebFingerModule } from "./webfinger/webfinger.module.js";
import { OidcModule } from "./oidc/oidc.module.js";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    LldapModule,
    SessionModule,
    ApiModule,
    WebFingerModule,
    OidcModule,
  ],
})
export class AppModule {}
