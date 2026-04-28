import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'trudy@go24.fitness' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'mySecret123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  deviceFingerprint?: string;

  @ApiPropertyOptional({ enum: ['ios', 'android'] })
  @IsString()
  @IsOptional()
  devicePlatform?: 'ios' | 'android';
}

export class RequestOtpDto {
  @ApiProperty({ example: 'trudy@go24.fitness' })
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Token from /request-otp' })
  @IsString()
  memberIdToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(4)
  code!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  deviceFingerprint?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
