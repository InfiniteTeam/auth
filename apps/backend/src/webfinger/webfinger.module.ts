/**
 * WebFinger module.
 */

import { Module } from "@nestjs/common";
import { WebFingerController } from "./webfinger.controller.js";

@Module({
  controllers: [WebFingerController],
})
export class WebFingerModule {}
