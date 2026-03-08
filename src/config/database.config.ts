import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  useFactory: (configService: ConfigService) => {
    const databaseUrl = configService.get<string>('DATABASE_URL');

    if (databaseUrl) {
      return {
        type: 'postgres' as const,
        url: databaseUrl,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        synchronize: false,
        migrationsRun: true,
      };
    }

    return {
      type: 'postgres' as const,
      host: configService.get<string>('DB_HOST', 'localhost'),
      port: configService.get<number>('DB_PORT', 5432),
      database: configService.get<string>('DB_NAME', 'toggl_facturoid'),
      username: configService.get<string>('DB_USER', 'postgres'),
      password: configService.get<string>('DB_PASSWORD', 'postgres'),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      synchronize: false,
      migrationsRun: true,
    };
  },
  inject: [ConfigService],
};
