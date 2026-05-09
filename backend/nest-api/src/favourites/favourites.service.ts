import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFavourite } from './entities/user-favourite.entity';

@Injectable()
export class FavouritesService {
  constructor(
    @InjectRepository(UserFavourite) private readonly repo: Repository<UserFavourite>,
  ) {}

  list(userId: string): Promise<UserFavourite[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async add(userId: string, input: {
    classTemplateId: string; className: string; instructorName?: string;
  }): Promise<UserFavourite> {
    try {
      const fav = this.repo.create({
        userId,
        classTemplateId: input.classTemplateId,
        className:       input.className,
        instructorName:  input.instructorName ?? null,
      });
      return await this.repo.save(fav);
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('Already a favourite');
      throw e;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.repo.delete({ id, userId });
  }

  async isFavourite(userId: string, classTemplateId: string): Promise<boolean> {
    return !!(await this.repo.findOne({ where: { userId, classTemplateId } }));
  }
}
