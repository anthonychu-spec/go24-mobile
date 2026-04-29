import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsPositive } from 'class-validator';

export class BookDto {
  @ApiProperty({ example: 12345 })
  @IsInt()
  @IsPositive()
  classId: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  acceptWaitlist?: boolean;
}

export class CancelDto {
  // No body needed — bookingId comes from the URL param
}
