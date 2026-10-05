import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for web and mobile clients
  app.enableCors({
    origin: [
      "http://localhost:3000", // Next.js web
      "http://localhost:8081", // Expo dev
    ],
    credentials: true,
  });

  app.setGlobalPrefix("api");

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}/api`);
}

bootstrap();
