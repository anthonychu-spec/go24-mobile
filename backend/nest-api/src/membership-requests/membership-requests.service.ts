import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipRequest } from './entities/membership-request.entity';

@Injectable()
export class MembershipRequestsService {
  constructor(
    @InjectRepository(MembershipRequest) private readonly repo: Repository<MembershipRequest>,
  ) {}

  async createFreeze(userId: string, input: {
    startDate: string; endDate: string; reason: string;
  }): Promise<MembershipRequest> {
    const start = new Date(input.startDate);
    const end   = new Date(input.endDate);
    const days  = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
    if (days > 90) throw new BadRequestException('Freeze period cannot exceed 90 days');
    if (days < 1)  throw new BadRequestException('End date must be after start date');

    const existing = await this.repo.findOne({ where: { userId, status: 'pending' } });
    if (existing)   throw new BadRequestException('You already have a pending request');

    const req = this.repo.create({ userId, type: 'freeze', ...input });
    return this.repo.save(req);
  }

  listRequests(userId: string): Promise<MembershipRequest[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }
}
