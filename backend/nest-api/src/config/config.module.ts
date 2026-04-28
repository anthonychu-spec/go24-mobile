import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'node:path';

// Look for env files in: current dir, then repo root (../../)
const repoRoot = join(__dirname, '..', '..', '..', '..');

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env.local',
        '.env',
        join(repoRoot, '.env.local'),
        join(repoRoot, '.env'),
      ],
    }),
  ],
})
export class ConfigModule {}
