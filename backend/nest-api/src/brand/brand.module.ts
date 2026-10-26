import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigController } from './app-config.controller';
import { BrandFeatureGuard } from './brand-feature.guard';
import { Brand, BrandClub, BrandFeature } from './brand.entity';
import { BrandService } from './brand.service';

/** Global: BrandService is injectable everywhere and BrandFeatureGuard runs on every route. */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Brand, BrandClub, BrandFeature]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({ secret: cfg.get<string>('JWT_SECRET') }),
    }),
  ],
  providers: [BrandService, { provide: APP_GUARD, useClass: BrandFeatureGuard }],
  controllers: [AppConfigController],
  exports: [BrandService],
})
export class BrandModule {}
