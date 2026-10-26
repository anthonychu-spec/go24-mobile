import {
  IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional,
  IsPositive, IsString, MaxLength,
} from 'class-validator';

// Without validators the global ValidationPipe (whitelist + forbidNonWhitelisted)
// rejected every signup body with 400.

// Selfie as base64 JPEG; ~3 MB image ≈ 4 MB of base64
const MAX_PHOTO_B64 = 4_500_000;

export class SignupSessionDto {
  @IsInt() @IsPositive() planId!: number;
  @IsNumber() @IsPositive() amountHkd!: number;
  @IsEmail() shopperEmail!: string;
}

export class SignupCompleteDto {
  @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() @MaxLength(30) phone!: string;
  @IsDateString() dateOfBirth!: string;
  @IsOptional() @IsIn(['Male', 'Female', 'NotSpecified']) sex!: string;
  @IsString() @MaxLength(300) address!: string;
  @IsInt() @IsPositive() clubId!: number;
  @IsInt() @IsPositive() planId!: number;
  @IsOptional() @IsDateString() startDate!: string;
  @IsNumber() @IsPositive() amountHkd!: number;
  @IsString() @IsNotEmpty() @MaxLength(MAX_PHOTO_B64) facePhotoB64!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) adyenPspReference!: string;
}

export class FaceRetryDto {
  @IsString() @IsNotEmpty() @MaxLength(MAX_PHOTO_B64) facePhotoB64!: string;
}
