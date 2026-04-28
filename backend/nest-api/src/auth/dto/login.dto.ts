import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsOptional()
  deviceFingerprint?: string;

  @IsString()
  @IsOptional()
  devicePlatform?: 'ios' | 'android';
}

export class RequestOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @IsString()
  memberIdToken!: string; // signed token containing memberId from /request-otp

  @IsString()
  @MinLength(4)
  code!: string;

  @IsString()
  @IsOptional()
  deviceFingerprint?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @IsString()
  refreshToken!: string;
}
