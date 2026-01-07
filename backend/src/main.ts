import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './shared/utils/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors({
    origin: configService.get('frontendUrl'),
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix(configService.get('apiPrefix', 'api'));

  // Setup Swagger
  if (configService.get('nodeEnv') !== 'production') {
    setupSwagger(app);
  }

  const port = configService.get('port', 3001);
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}/${configService.get('apiPrefix', 'api')}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api-docs`);
}
bootstrap();