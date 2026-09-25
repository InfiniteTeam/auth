/**
 * Config module — exposes the validated {@link AppConfig} as an injectable,
 * plus the {@link PlatformSettingsService} that layers admin overrides on top
 * of those environment defaults.
 */

import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, loadConfig } from "./config.js";
import { PlatformSettingsService } from "./platform-settings.service.js";

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: loadConfig,
    },
    PlatformSettingsService,
  ],
  exports: [APP_CONFIG, PlatformSettingsService],
})
export class ConfigModule {}
