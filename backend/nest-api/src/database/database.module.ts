import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.get<string>('DATABASE_URL') || 'postgresql://go24:go24@localhost:5432/gym_members',
        autoLoadEntities: true,
        synchronize: false, // never true in any real env — use migrations
        logging: ['error', 'warn'],
      }),
    }),
  ],
})
export class DatabaseModule {}
