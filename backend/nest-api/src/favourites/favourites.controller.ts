import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { FavouritesService } from './favourites.service';
import { RequiresFeature } from '../brand/brand-feature.guard';

class AddFavouriteDto {
  @IsString() @IsNotEmpty() @MaxLength(50) classTemplateId: string;
  @IsString() @IsNotEmpty() @MaxLength(200) className: string;
  @IsOptional() @IsString() @MaxLength(100) instructorName?: string;
}

@ApiTags('favourites')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@RequiresFeature('favourites')
@Controller('me/favourites')
export class FavouritesController {
  constructor(private readonly svc: FavouritesService) {}

  @ApiOperation({ summary: 'List favourite classes' })
  @Get()
  list(@Req() req: Request) {
    return this.svc.list((req.user as AuthedUser).id);
  }

  @ApiOperation({ summary: 'Add a favourite class' })
  @Post()
  add(
    @Req() req: Request,
    @Body() body: AddFavouriteDto,
  ) {
    return this.svc.add((req.user as AuthedUser).id, body);
  }

  @ApiOperation({ summary: 'Remove a favourite class' })
  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.svc.remove((req.user as AuthedUser).id, id);
  }
}
