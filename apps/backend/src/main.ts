/**
 * Application bootstrap.
 *
 * Wires cookie parsing, body/validation, CORS, the OIDC provider (mounted on
 * the raw Express instance) and the public OpenAPI / Swagger UI.
 */

import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import Provider from "oidc-provider";
import { AppModule } from "./app.module.js";
import { OIDC_PROVIDER } from "./oidc/oidc.module.js";
import { isOidcRoute } from "./oidc/oidc-routes.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const provider = app.get<Provider>(OIDC_PROVIDER);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Mount the OIDC provider on the raw Express instance. Only oidc-provider
  // routes (`/auth`, `/token`, `/.well-known/openid-configuration`,
  // `/.well-known/jwks.json`, `/interaction/*`, ...) are delegated to its
  // callback; every other path falls through to the Nest router (the
  // `/api/v1/*` API and the WebFinger endpoint).
  const express = app.getHttpAdapter().getInstance() as {
    use: (
      handler: (req: Request, res: Response, next: NextFunction) => void,
    ) => unknown;
  };
  // oidc-provider's callback follows (req, res) and responds on its own; it is
  // only invoked for oidc-provider-owned routes.
  const oidcCallback = provider.callback() as (
    req: Request,
    res: Response,
  ) => void;
  express.use((req, res, next) => {
    if (isOidcRoute(req.path)) {
      oidcCallback(req, res);
      return;
    }
    next();
  });

  const documentConfig = new DocumentBuilder()
    .setTitle("inft-auth backend")
    .setDescription("OIDC / OAuth 2.0, LDAP identity and session API.")
    .setVersion("1.0.0")
    .addTag("auth")
    .addTag("session")
    .addTag("admin")
    .addTag("webfinger")
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup("api-docs", app, document);

  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
