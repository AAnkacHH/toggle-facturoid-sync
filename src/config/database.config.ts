import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  useFactory: (configService: ConfigService) => {
    const databaseUrl = configService.get<string>('DATABASE_URL');

    if (databaseUrl) {
      return {
        type: 'postgres' as const,
        url: databaseUrl,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        migrationsRun: true,
      };
    }

    const password = configService.get<string>('DB_PASSWORD');
    if (!password) {
      throw new Error(
        'DB_PASSWORD environment variable is required when DATABASE_URL is not set',
      );
    }

    return {
      type: 'postgres' as const,
      host: configService.get<string>('DB_HOST', 'localhost'),
      port: configService.get<number>('DB_PORT', 5432),
      database: configService.get<string>('DB_NAME', 'toggl_facturoid'),
      username: configService.get<string>('DB_USER', 'postgres'),
      password,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false,
      migrationsRun: true,
    };
  },
  inject: [ConfigService],
};
