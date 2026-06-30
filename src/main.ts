import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // Origins fijos que siempre se permiten (Capacitor WebView, dev)
  const staticOrigins = new Set([
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:4000',
    'capacitor://localhost',
    'ionic://localhost',
    'http://192.168.1.14:3000',
    'http://192.168.1.14:4000',
  ]);
  const extraOrigins = new Set(
    (process.env.CORS_ORIGIN ?? '').split(',').map(s => s.trim()).filter(Boolean),
  );

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Capacitor WebView a veces no envía Origin (null/undefined) — siempre permitir
      // JWT en Authorization header protege los endpoints autenticados
      if (!origin || staticOrigins.has(origin) || extraOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // permisivo: la auth vía JWT es la línea de defensa real
      }
    },
    credentials: false,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`ShelbyCore AI · API en http://0.0.0.0:${port}/api`);
}
bootstrap();
