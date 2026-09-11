/**
 * OIDC module.
 *
 * Builds and exposes the shared `oidc-provider` {@link Provider} instance under
 * the {@link OIDC_PROVIDER} token, wiring in the Prisma adapter and lldap-backed
 * `findAccount`.
 */

import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { LldapService } from "../lldap/lldap.service.js";
import { LldapModule } from "../lldap/lldap.module.js";
import { SessionModule } from "../session/session.module.js";
import { createProvider } from "./provider.factory.js";
import { OidcInteractionController } from "./oidc-interaction.controller.js";
import { OIDC_PROVIDER } from "./oidc-tokens.js";

/** Re-exported for backwards compatibility; prefer `./oidc-tokens.js`. */
export { OIDC_PROVIDER };

@Global()
@Module({
  imports: [LldapModule, SessionModule],
  controllers: [OidcInteractionController],
  providers: [
    {
      provide: OIDC_PROVIDER,
      inject: [APP_CONFIG, PrismaService, LldapService],
      useFactory: createProvider,
    },
  ],
  exports: [OIDC_PROVIDER],
})
export class OidcModule {}
