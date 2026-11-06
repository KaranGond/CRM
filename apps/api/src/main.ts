import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ["http://localhost:3000", "http://localhost:8081"],
    credentials: true,
  });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Telecalling CRM API")
    .setDescription("Master API for telecallers, managers, sync, and device telemetry")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "api/docs-json",
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}/api`);
  console.log(`📖 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
