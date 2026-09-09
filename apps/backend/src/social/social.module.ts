/**
 * Social module — GitHub/Discord sign-in, sign-up and account linking.
 */

import { Module } from "@nestjs/common";
import { MailService } from "./mail.service.js";
import { OAuthStateService } from "./oauth-state.service.js";
import { SocialSettingsService } from "./social-settings.service.js";
import { VerificationService } from "./verification.service.js";
import { SocialService } from "./social.service.js";
import { SocialController } from "./social.controller.js";
import { GithubProvider } from "./providers/github.provider.js";
import { DiscordProvider } from "./providers/discord.provider.js";
import { SOCIAL_PROVIDERS } from "./providers/provider.interface.js";
import { LldapModule } from "../lldap/lldap.module.js";
import { SessionModule } from "../session/session.module.js";

@Module({
  imports: [LldapModule, SessionModule],
  controllers: [SocialController],
  providers: [
    MailService,
    OAuthStateService,
    SocialSettingsService,
    VerificationService,
    SocialService,
    GithubProvider,
    DiscordProvider,
    {
      provide: SOCIAL_PROVIDERS,
      useFactory: (github: GithubProvider, discord: DiscordProvider) => [
        github,
        discord,
      ],
      inject: [GithubProvider, DiscordProvider],
    },
  ],
  exports: [
    MailService,
    OAuthStateService,
    SocialSettingsService,
    VerificationService,
    SocialService,
    GithubProvider,
    DiscordProvider,
    SOCIAL_PROVIDERS,
  ],
})
export class SocialModule {}