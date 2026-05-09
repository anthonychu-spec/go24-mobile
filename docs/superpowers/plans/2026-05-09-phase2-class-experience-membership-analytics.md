# Phase 2: Class Experience + Membership Self-Service + Analytics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add class favourites, reminders, streak tracking, waitlist auto-cancel (A); freeze requests and payment history with PDF invoices (B); monthly summary push, milestone badges, and activity calendar heatmap (C).

**Architecture:** Three new NestJS modules (FavouritesModule, SettingsModule, MembershipRequestsModule) + extensions to existing NotificationsService and DashboardService. Mobile gets new screens for favourites, freeze form, payment history, and a calendar heatmap toggle on the activity screen.

**Tech Stack:** NestJS 11, TypeORM, PostgreSQL, @nestjs/schedule, pdfkit (PDF generation), expo-router v4, react-native-calendars (heatmap)

---

## File Map

### Backend — New
| File | Purpose |
|------|---------|
| `src/favourites/favourites.module.ts` | FavouritesModule |
| `src/favourites/favourites.controller.ts` | GET/POST/DELETE /me/favourites |
| `src/favourites/favourites.service.ts` | CRUD for user_favourites |
| `src/favourites/entities/user-favourite.entity.ts` | UserFavourite entity |
| `src/settings/settings.module.ts` | SettingsModule |
| `src/settings/settings.controller.ts` | GET/PATCH /me/settings |
| `src/settings/settings.service.ts` | Read/write user_settings row |
| `src/settings/entities/user-settings.entity.ts` | UserSettings entity |
| `src/membership-requests/membership-requests.module.ts` | MembershipRequestsModule |
| `src/membership-requests/membership-requests.controller.ts` | POST /me/membership/freeze-request, GET /me/membership/requests |
| `src/membership-requests/membership-requests.service.ts` | Create + list requests |
| `src/membership-requests/entities/membership-request.entity.ts` | MembershipRequest entity |
| `src/milestones/milestones.module.ts` | MilestonesModule |
| `src/milestones/milestones.service.ts` | Check + award milestones |
| `src/milestones/entities/member-milestone.entity.ts` | MemberMilestone entity |

### Backend — Modified
| File | Change |
|------|--------|
| `src/dashboard/dashboard.service.ts` | Add streak calculation to getDashboard() |
| `src/dashboard/dashboard.module.ts` | Import SettingsModule |
| `src/payments/payments.service.ts` | Add getPaymentHistory(), generateInvoicePdf() |
| `src/payments/payments.controller.ts` | Add GET /me/payments, GET /me/payments/:id/invoice |
| `src/notifications/notifications.service.ts` | Add monthly summary cron + sendToAllActive() |
| `src/bookings/bookings.service.ts` | On booking confirmed: schedule reminder; waitlist auto-cancel cron |
| `src/app.module.ts` | Import 4 new modules |

### Mobile — New
| File | Purpose |
|------|---------|
| `app/favourites.tsx` | Favourite classes list + quick book |
| `app/membership/freeze.tsx` | Freeze request form |
| `app/payments/history.tsx` | Payment history list + download invoice |

### Mobile — Modified
| File | Change |
|------|--------|
| `app/(tabs)/classes.tsx` | Add ⭐ star button per class row |
| `app/(tabs)/activity.tsx` | Add calendar heatmap toggle view |
| `app/(tabs)/index.tsx` | Streak in stats, Favourites in quick actions |
| `app/profile.tsx` | Add links: Freeze Membership, Payment History |

---

## Task 1: DB migrations — 4 new tables

- [ ] **Step 1: Run all migrations**

```bash
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "docker exec go24-db psql -U go24 -d go24 -c \"
CREATE TABLE IF NOT EXISTS user_favourites (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL,
  class_template_id VARCHAR NOT NULL,
  class_name        VARCHAR NOT NULL,
  instructor_name   VARCHAR,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, class_template_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id              VARCHAR PRIMARY KEY,
  reminder_minutes     INT NOT NULL DEFAULT 60,
  auto_waitlist_cancel BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS membership_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    VARCHAR NOT NULL,
  type       VARCHAR NOT NULL DEFAULT 'freeze',
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  reason     VARCHAR NOT NULL,
  status     VARCHAR NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR NOT NULL,
  milestone   INT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, milestone)
);

CREATE INDEX IF NOT EXISTS idx_user_favs_user ON user_favourites(user_id);
CREATE INDEX IF NOT EXISTS idx_mem_reqs_user  ON membership_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_user ON member_milestones(user_id);
\""
```

- [ ] **Step 2: Verify**

```bash
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "docker exec go24-db psql -U go24 -d go24 -c \"\dt user_favourites user_settings membership_requests member_milestones\""
```

Expected: 4 tables listed.

---

## Task 2: UserFavourite entity + FavouritesModule

**Files:**
- Create: `backend/nest-api/src/favourites/entities/user-favourite.entity.ts`
- Create: `backend/nest-api/src/favourites/favourites.service.ts`
- Create: `backend/nest-api/src/favourites/favourites.controller.ts`
- Create: `backend/nest-api/src/favourites/favourites.module.ts`

- [ ] **Step 1: Entity**

```typescript
// src/favourites/entities/user-favourite.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('user_favourites')
@Unique(['userId', 'classTemplateId'])
export class UserFavourite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ type: 'varchar', name: 'class_template_id' })
  classTemplateId!: string;

  @Column({ type: 'varchar', name: 'class_name' })
  className!: string;

  @Column({ type: 'varchar', name: 'instructor_name', nullable: true })
  instructorName!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
```

- [ ] **Step 2: Service**

```typescript
// src/favourites/favourites.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFavourite } from './entities/user-favourite.entity';

@Injectable()
export class FavouritesService {
  constructor(
    @InjectRepository(UserFavourite) private readonly repo: Repository<UserFavourite>,
  ) {}

  async list(userId: string): Promise<UserFavourite[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async add(userId: string, input: { classTemplateId: string; className: string; instructorName?: string }): Promise<UserFavourite> {
    try {
      const fav = this.repo.create({ userId, ...input, instructorName: input.instructorName ?? null });
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
```

- [ ] **Step 3: Controller**

```typescript
// src/favourites/favourites.controller.ts
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { FavouritesService } from './favourites.service';

@ApiTags('favourites')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
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
  add(@Req() req: Request, @Body() body: { classTemplateId: string; className: string; instructorName?: string }) {
    return this.svc.add((req.user as AuthedUser).id, body);
  }

  @ApiOperation({ summary: 'Remove a favourite class' })
  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.svc.remove((req.user as AuthedUser).id, id);
  }
}
```

- [ ] **Step 4: Module**

```typescript
// src/favourites/favourites.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserFavourite } from './entities/user-favourite.entity';
import { FavouritesController } from './favourites.controller';
import { FavouritesService } from './favourites.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserFavourite])],
  controllers: [FavouritesController],
  providers: [FavouritesService],
  exports: [FavouritesService],
})
export class FavouritesModule {}
```

- [ ] **Step 5: Commit**

```bash
git add backend/nest-api/src/favourites/
git commit -m "feat: FavouritesModule — GET/POST/DELETE /me/favourites"
```

---

## Task 3: UserSettings entity + SettingsModule

**Files:**
- Create: `backend/nest-api/src/settings/entities/user-settings.entity.ts`
- Create: `backend/nest-api/src/settings/settings.service.ts`
- Create: `backend/nest-api/src/settings/settings.controller.ts`
- Create: `backend/nest-api/src/settings/settings.module.ts`

- [ ] **Step 1: Entity**

```typescript
// src/settings/entities/user-settings.entity.ts
import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn({ type: 'varchar', name: 'user_id' })
  userId!: string;

  @Column({ type: 'int', name: 'reminder_minutes', default: 60 })
  reminderMinutes!: number;

  @Column({ type: 'boolean', name: 'auto_waitlist_cancel', default: false })
  autoWaitlistCancel!: boolean;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 2: Service**

```typescript
// src/settings/settings.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSettings) private readonly repo: Repository<UserSettings>,
  ) {}

  async get(userId: string): Promise<UserSettings> {
    const existing = await this.repo.findOne({ where: { userId } });
    if (existing) return existing;
    // Return defaults without saving
    const defaults = new UserSettings();
    defaults.userId = userId;
    defaults.reminderMinutes = 60;
    defaults.autoWaitlistCancel = false;
    return defaults;
  }

  async update(userId: string, patch: Partial<Pick<UserSettings, 'reminderMinutes' | 'autoWaitlistCancel'>>): Promise<UserSettings> {
    await this.repo.upsert({ userId, ...patch }, ['userId']);
    return this.get(userId);
  }
}
```

- [ ] **Step 3: Controller**

```typescript
// src/settings/settings.controller.ts
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('me/settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @ApiOperation({ summary: 'Get notification and preference settings' })
  @Get()
  get(@Req() req: Request) {
    return this.svc.get((req.user as AuthedUser).id);
  }

  @ApiOperation({ summary: 'Update settings' })
  @Patch()
  update(
    @Req() req: Request,
    @Body() body: { reminderMinutes?: number; autoWaitlistCancel?: boolean },
  ) {
    return this.svc.update((req.user as AuthedUser).id, body);
  }
}
```

- [ ] **Step 4: Module**

```typescript
// src/settings/settings.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettings])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
```

- [ ] **Step 5: Commit**

```bash
git add backend/nest-api/src/settings/
git commit -m "feat: SettingsModule — GET/PATCH /me/settings (reminderMinutes, autoWaitlistCancel)"
```

---

## Task 4: Streak calculation in Dashboard

**Files:**
- Modify: `backend/nest-api/src/dashboard/dashboard.service.ts`

- [ ] **Step 1: Add streak to DashboardData interface**

```typescript
// In DashboardData interface, add:
streak: number; // consecutive weeks with at least 1 activity
```

- [ ] **Step 2: Add fetchStreak() private method**

```typescript
private async fetchStreak(pgmMemberId: number, userId: string): Promise<number> {
  try {
    // Get visit dates from PGM (last 52 weeks)
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const [visitsRes, classesRes] = await Promise.allSettled([
      this.pgm.get<{ value: any[] }>('/odata/Visits', {
        $filter: `memberId eq ${pgmMemberId} and enterDate ge datetime'${since.toISOString().slice(0, 19)}'`,
        $select: 'enterDate',
        $top: 500,
      }),
      this.bookingRepo.find({
        where: { userId, status: 'attended' },
        select: ['createdAt'],
      }),
    ]);

    const activityDates = new Set<string>();

    if (visitsRes.status === 'fulfilled') {
      for (const v of visitsRes.value.value ?? []) {
        const d = new Date(v.enterDate);
        activityDates.add(this.isoWeek(d));
      }
    }
    if (classesRes.status === 'fulfilled') {
      for (const b of classesRes.value) {
        activityDates.add(this.isoWeek(new Date(b.createdAt)));
      }
    }

    // Count consecutive weeks ending this week
    let streak = 0;
    const now = new Date();
    for (let w = 0; w < 52; w++) {
      const check = new Date(now);
      check.setDate(check.getDate() - w * 7);
      if (activityDates.has(this.isoWeek(check))) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  } catch { return 0; }
}

private isoWeek(d: Date): string {
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() - tmp.getDay() + 1); // Monday
  return tmp.toISOString().slice(0, 10);
}
```

- [ ] **Step 3: Add streak to getDashboard() parallel calls**

```typescript
const [contracts, ptAgreements, visits, nextBooking, monthClasses, memberMeta, streak] =
  await Promise.allSettled([
    this.fetchActiveContract(pgmMemberId),
    this.fetchPtAgreements(pgmMemberId),
    this.fetchMonthVisits(pgmMemberId, monthStart),
    this.fetchNextBooking(userId),
    this.bookingRepo.count({ where: { userId, status: 'confirmed', createdAt: MoreThan(monthStart) } }),
    this.fetchMemberMeta(pgmMemberId),
    this.fetchStreak(pgmMemberId, userId),
  ]);

// In return:
streak: streak.status === 'fulfilled' ? streak.value : 0,
```

- [ ] **Step 4: Commit**

```bash
git add backend/nest-api/src/dashboard/dashboard.service.ts
git commit -m "feat: add weekly streak calculation to dashboard"
```

---

## Task 5: Class reminders — schedule push on booking confirmed

**Files:**
- Modify: `backend/nest-api/src/bookings/bookings.service.ts` (or booking.service.ts — check which file handles booking confirmation)

- [ ] **Step 1: Find where booking status transitions to 'confirmed'**

```bash
grep -n "confirmed" backend/nest-api/src/bookings/bookings.service.ts | head -20
```

- [ ] **Step 2: After booking confirmed, schedule reminder push**

In the booking confirmation logic, after setting `status = 'confirmed'`:

```typescript
// Schedule class reminder push
this.scheduleClassReminder(booking.userId, booking.classId, classStartTime).catch(() => {});
```

Add private method to the service:

```typescript
private async scheduleClassReminder(
  userId: string,
  classId: number,
  classStartTime: Date,
): Promise<void> {
  try {
    // Get user's reminder preference
    const settings = await this.settingsService.get(userId);
    if (settings.reminderMinutes === 0) return; // reminders off

    const fireAt = new Date(classStartTime.getTime() - settings.reminderMinutes * 60_000);
    if (fireAt <= new Date()) return; // class already starting soon

    const delayMs = fireAt.getTime() - Date.now();
    const className = `Class #${classId}`; // or fetch class name

    // Use setTimeout for in-process scheduling (simple approach)
    // For production: use a job queue (Bull/BullMQ). For now setTimeout is fine.
    setTimeout(async () => {
      await this.notificationsService.sendPush(
        userId,
        '🏋️ Class starting soon',
        `Your class starts in ${settings.reminderMinutes} minutes. See you there!`,
        { type: 'class_reminder', classId },
      );
    }, delayMs);
  } catch { /* non-fatal */ }
}
```

Note: inject SettingsService + NotificationsService into the bookings module.

- [ ] **Step 3: Commit**

```bash
git add backend/nest-api/src/bookings/
git commit -m "feat: schedule class reminder push on booking confirmed"
```

---

## Task 6: Waitlist auto-cancel cron

**Files:**
- Modify: `backend/nest-api/src/bookings/bookings.service.ts`

- [ ] **Step 1: Add cron method**

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

// Add to BookingsService (or a dedicated BookingsCronService):
@Cron('*/15 * * * *') // every 15 minutes
async autoReleaseWaitlistSpots(): Promise<void> {
  const fiveHoursFromNow = new Date(Date.now() + 5 * 60 * 60 * 1000);

  // Find bookings that became confirmed while class is within 5 hours
  // We rely on class start time stored in booking or fetched from PGM
  // Simple approach: find all 'waitlist' bookings and check against PGM class time
  const waitlistBookings = await this.bookingRepo.find({
    where: { status: 'waitlist' },
    take: 100,
  });

  for (const booking of waitlistBookings) {
    try {
      const cls = await this.bookingAdapter.getClass(booking.classId);
      const startTime = new Date(cls.startTime);
      if (startTime > fiveHoursFromNow) continue; // class is > 5h away, skip

      // Class is within 5 hours AND still on waitlist
      const settings = await this.settingsService.get(booking.userId);

      if (settings.autoWaitlistCancel) {
        // Auto-cancel
        booking.status = 'cancelled';
        await this.bookingRepo.save(booking);
        await this.pgm.post(`/odata/ClassBookings(${booking.pgmBookingId})/Cancel`, {});
        await this.notificationsService.sendPush(
          booking.userId,
          'Waitlist spot released',
          `Your waitlist spot for Class #${booking.classId} was auto-released (class in < 5 hours).`,
          { type: 'waitlist_auto_cancelled', classId: booking.classId },
        );
      } else {
        // Send reminder only — don't auto-cancel
        await this.notificationsService.sendPush(
          booking.userId,
          '⏰ Waitlist confirmed — can you make it?',
          `You're confirmed for Class #${booking.classId} starting soon. Reply to cancel if needed.`,
          { type: 'waitlist_reminder', classId: booking.classId },
        );
      }
    } catch { /* skip this booking */ }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/nest-api/src/bookings/
git commit -m "feat: waitlist auto-cancel cron (every 15min, checks 5h window)"
```

---

## Task 7: MembershipRequests module

**Files:**
- Create: `backend/nest-api/src/membership-requests/` (entity, service, controller, module)

- [ ] **Step 1: Entity**

```typescript
// src/membership-requests/entities/membership-request.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

@Entity('membership_requests')
export class MembershipRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ type: 'varchar', default: 'freeze' })
  type!: 'freeze';

  @Column({ type: 'date', name: 'start_date' })
  startDate!: string;

  @Column({ type: 'date', name: 'end_date' })
  endDate!: string;

  @Column({ type: 'varchar' })
  reason!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: RequestStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
```

- [ ] **Step 2: Service**

```typescript
// src/membership-requests/membership-requests.service.ts
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
    // Max 90 days
    const start = new Date(input.startDate);
    const end   = new Date(input.endDate);
    const days  = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    if (days > 90) throw new BadRequestException('Freeze period cannot exceed 90 days');
    if (days < 1)  throw new BadRequestException('End date must be after start date');

    // Check no pending request already
    const existing = await this.repo.findOne({ where: { userId, status: 'pending' } });
    if (existing) throw new BadRequestException('You already have a pending request');

    const req = this.repo.create({ userId, type: 'freeze', ...input });
    return this.repo.save(req);
  }

  async listRequests(userId: string): Promise<MembershipRequest[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }
}
```

- [ ] **Step 3: Controller**

```typescript
// src/membership-requests/membership-requests.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { MembershipRequestsService } from './membership-requests.service';

@ApiTags('membership')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('me/membership')
export class MembershipRequestsController {
  constructor(private readonly svc: MembershipRequestsService) {}

  @ApiOperation({ summary: 'Submit a freeze request' })
  @Post('freeze-request')
  freeze(@Req() req: Request, @Body() body: { startDate: string; endDate: string; reason: string }) {
    return this.svc.createFreeze((req.user as AuthedUser).id, body);
  }

  @ApiOperation({ summary: 'List all membership requests' })
  @Get('requests')
  list(@Req() req: Request) {
    return this.svc.listRequests((req.user as AuthedUser).id);
  }
}
```

- [ ] **Step 4: Module + add to AppModule**

```typescript
// src/membership-requests/membership-requests.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipRequest } from './entities/membership-request.entity';
import { MembershipRequestsController } from './membership-requests.controller';
import { MembershipRequestsService } from './membership-requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([MembershipRequest])],
  controllers: [MembershipRequestsController],
  providers: [MembershipRequestsService],
})
export class MembershipRequestsModule {}
```

In `src/app.module.ts` add:
```typescript
import { FavouritesModule } from './favourites/favourites.module';
import { SettingsModule } from './settings/settings.module';
import { MembershipRequestsModule } from './membership-requests/membership-requests.module';
// in imports:
FavouritesModule, SettingsModule, MembershipRequestsModule,
```

- [ ] **Step 5: Commit**

```bash
git add backend/nest-api/src/membership-requests/ backend/nest-api/src/app.module.ts
git commit -m "feat: MembershipRequestsModule — freeze request + list"
```

---

## Task 8: Payment history + PDF invoice

**Files:**
- Modify: `backend/nest-api/src/payments/payments.service.ts`
- Modify: `backend/nest-api/src/payments/payments.controller.ts`

- [ ] **Step 1: Install pdfkit**

```bash
cd backend/nest-api && npm install pdfkit @types/pdfkit
```

- [ ] **Step 2: Add getPaymentHistory() to PaymentsService**

```typescript
async getPaymentHistory(userId: string, pgmId: number): Promise<any[]> {
  const [chargesRes, invoicesRes] = await Promise.allSettled([
    this.chargeRepo.find({
      where: { userId, status: 'authorised' },
      order: { createdAt: 'DESC' },
      take: 50,
    }),
    this.pgm.get<{ value: any[] }>('/odata/Invoices', {
      $filter: `memberId eq ${pgmId}`,
      $select: 'id,totalAmount,invoiceDate,description,status',
      $top: 50,
      $orderby: 'invoiceDate desc',
    }),
  ]);

  const charges = chargesRes.status === 'fulfilled' ? chargesRes.value : [];
  const pgmInvoices = invoicesRes.status === 'fulfilled' ? (invoicesRes.value.value ?? []) : [];

  const result = [
    ...charges.map(c => ({
      id: c.id,
      source: 'app' as const,
      date: c.createdAt.toISOString(),
      amountHkd: Number(c.amountHkd),
      description: c.description,
      status: c.status,
      invoiceAvailable: true,
    })),
    ...pgmInvoices.map((inv: any) => ({
      id: `pgm-${inv.id}`,
      source: 'pgm' as const,
      date: inv.invoiceDate,
      amountHkd: inv.totalAmount ?? 0,
      description: inv.description ?? 'Membership fee',
      status: inv.status ?? 'Unknown',
      invoiceAvailable: false,
    })),
  ];

  return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

async generateInvoicePdf(userId: string, chargeId: string): Promise<Buffer> {
  const charge = await this.chargeRepo.findOne({ where: { id: chargeId, userId } });
  if (!charge) throw new NotFoundException('Invoice not found');

  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('GO24 FITNESS', 50, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#888').text('Receipt / Invoice', 50, 80);

    // Line
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#eee').stroke();

    // Details
    doc.fillColor('#333').fontSize(12).font('Helvetica-Bold').text('Payment Details', 50, 120);
    const details = [
      ['Date',        new Date(charge.createdAt).toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' })],
      ['Description', charge.description],
      ['Amount',      `HK$${Number(charge.amountHkd).toFixed(2)}`],
      ['Reference',   charge.adyenRef ?? charge.id],
      ['Status',      'Paid'],
    ];
    let y = 145;
    for (const [label, value] of details) {
      doc.font('Helvetica').fontSize(10).fillColor('#888').text(label, 50, y);
      doc.font('Helvetica').fontSize(10).fillColor('#333').text(value, 180, y);
      y += 22;
    }

    // Footer
    doc.fontSize(9).fillColor('#aaa').text('GO24 Fitness — go24.fitness', 50, 720, { align: 'center' });
    doc.end();
  });
}
```

Also add `PgmClient` injection to `PaymentsService` constructor:
```typescript
constructor(
  private readonly adyen: AdyenClient,
  private readonly cfg: ConfigService,
  private readonly pgm: PgmClient,  // ADD
  @InjectRepository(PaymentMethod) private readonly repo: Repository<PaymentMethod>,
  @InjectRepository(Charge) private readonly chargeRepo: Repository<Charge>,
) {}
```

And import `PgmModule` in `PaymentsModule`.

- [ ] **Step 3: Add routes to PaymentsController**

```typescript
import { Param, Res } from '@nestjs/common';
import type { Response } from 'express';

@ApiOperation({ summary: 'Payment history (app charges + PGM invoices)' })
@Get('/me/payments')
@UseGuards(JwtAuthGuard)
getPaymentHistory(@Req() req: Request) {
  const user = req.user as AuthedUser;
  return this.svc.getPaymentHistory(user.id, user.pgmId);
}

@ApiOperation({ summary: 'Download invoice PDF for a charge' })
@Get('/me/payments/:id/invoice')
@UseGuards(JwtAuthGuard)
async downloadInvoice(
  @Req() req: Request,
  @Param('id') id: string,
  @Res() res: Response,
) {
  const pdf = await this.svc.generateInvoicePdf((req.user as AuthedUser).id, id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="go24-invoice-${id}.pdf"`);
  res.end(pdf);
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/nest-api/src/payments/
git commit -m "feat: payment history endpoint + PDF invoice generation"
```

---

## Task 9: Monthly summary cron + Milestones

**Files:**
- Create: `backend/nest-api/src/milestones/entities/member-milestone.entity.ts`
- Create: `backend/nest-api/src/milestones/milestones.service.ts`
- Create: `backend/nest-api/src/milestones/milestones.module.ts`
- Modify: `backend/nest-api/src/notifications/notifications.service.ts`

- [ ] **Step 1: MemberMilestone entity**

```typescript
// src/milestones/entities/member-milestone.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export const MILESTONE_LEVELS = [10, 50, 100, 200] as const;
export type MilestoneLevel = typeof MILESTONE_LEVELS[number];

const MILESTONE_LABELS: Record<MilestoneLevel, { emoji: string; title: string; message: string }> = {
  10:  { emoji: '🥉', title: 'First Steps',   message: "You've visited GO24 10 times!" },
  50:  { emoji: '🥈', title: 'Regular',        message: '50 visits — you\'re a GO24 regular!' },
  100: { emoji: '🥇', title: 'Centurion',      message: '100 visits — incredible commitment!' },
  200: { emoji: '💎', title: 'Legend',          message: '200 visits — you\'re a GO24 legend!' },
};
export { MILESTONE_LABELS };

@Entity('member_milestones')
@Unique(['userId', 'milestone'])
export class MemberMilestone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ type: 'int' })
  milestone!: number;

  @Column({ type: 'timestamptz', name: 'unlocked_at' })
  unlockedAt!: Date;
}
```

- [ ] **Step 2: MilestonesService**

```typescript
// src/milestones/milestones.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberMilestone, MILESTONE_LABELS, MILESTONE_LEVELS } from './entities/member-milestone.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    @InjectRepository(MemberMilestone) private readonly repo: Repository<MemberMilestone>,
    private readonly notifications: NotificationsService,
  ) {}

  async checkAndAward(userId: string, totalVisits: number): Promise<void> {
    for (const level of MILESTONE_LEVELS) {
      if (totalVisits < level) continue;

      const existing = await this.repo.findOne({ where: { userId, milestone: level } });
      if (existing) continue;

      // Award new milestone
      const milestone = this.repo.create({ userId, milestone: level, unlockedAt: new Date() });
      await this.repo.save(milestone);

      const meta = MILESTONE_LABELS[level];
      this.logger.log(`Milestone ${level} awarded to ${userId}`);
      await this.notifications.sendPush(
        userId,
        `${meta.emoji} ${meta.title}`,
        meta.message,
        { type: 'milestone', level },
      ).catch(() => {});
    }
  }

  async listMilestones(userId: string): Promise<MemberMilestone[]> {
    return this.repo.find({ where: { userId }, order: { milestone: 'ASC' } });
  }
}
```

- [ ] **Step 3: MilestonesModule**

```typescript
// src/milestones/milestones.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberMilestone } from './entities/member-milestone.entity';
import { MilestonesService } from './milestones.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([MemberMilestone]), NotificationsModule],
  providers: [MilestonesService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
```

- [ ] **Step 4: Add GET /me/milestones to DashboardController**

In `dashboard.controller.ts`:

```typescript
@ApiOperation({ summary: 'Member achievement milestones' })
@Get('milestones')
async milestones(@Req() req: Request) {
  const user = req.user as AuthedUser;
  return this.milestonesService.listMilestones(user.id);
}
```

Inject `MilestonesService` into `DashboardModule`.

- [ ] **Step 5: Monthly summary cron in NotificationsService**

```typescript
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';

// In NotificationsService, add:
@Cron('0 9 1 * *', { timeZone: 'Asia/Hong_Kong' }) // 9 AM HKT on 1st of every month
async sendMonthlySummary(): Promise<void> {
  this.logger.log('Sending monthly summary notifications...');
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const monthName = lastMonth.toLocaleDateString('en-HK', { month: 'long', year: 'numeric' });

  // Get all active users with push tokens
  const users = await this.userRepo.find({ where: { status: 'active' } });

  for (const user of users) {
    try {
      // Fetch their stats for last month (simplified - just visits)
      const visits = await this.fetchLastMonthVisits(user.pgmMemberId, lastMonth);
      if (visits === 0) continue; // don't send if inactive

      await this.sendPush(
        user.id,
        `Your ${monthName} Summary 💪`,
        `You visited GO24 ${visits} time${visits !== 1 ? 's' : ''} last month. Keep it up!`,
        { type: 'monthly_summary', month: monthName, visits },
      );
    } catch { /* skip user */ }
  }
}

private async fetchLastMonthVisits(pgmMemberId: number, month: Date): Promise<number> {
  try {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end   = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const res = await this.pgm.get<{ value: any[] }>('/odata/Visits', {
      $filter: `memberId eq ${pgmMemberId} and enterDate ge datetime'${start.toISOString().slice(0,19)}' and enterDate le datetime'${end.toISOString().slice(0,19)}'`,
      $select: 'id',
      $top: 200,
    });
    return res.value?.length ?? 0;
  } catch { return 0; }
}
```

Inject `Repository<User>` and `PgmClient` into NotificationsService.

- [ ] **Step 6: Add all new modules to AppModule**

```typescript
import { MilestonesModule } from './milestones/milestones.module';
// in imports: MilestonesModule,
```

- [ ] **Step 7: Commit**

```bash
git add backend/nest-api/src/milestones/ backend/nest-api/src/notifications/
git commit -m "feat: milestones awards + monthly summary cron"
```

---

## Task 10: Deploy backend Phase 2

- [ ] **Step 1: Push and deploy**

```bash
git push origin main
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "cd /opt/go24 && git pull origin main && \
   docker compose -f infra/droplet/docker-compose.prod.yml up -d --build api && \
   sleep 15 && docker logs go24-api --tail 20"
```

- [ ] **Step 2: Verify new routes**

```bash
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "docker logs go24-api 2>&1 | grep -E 'favourites|settings|freeze|payments|milestones'"
```

Expected:
```
Mapped {/v1/me/favourites, GET}
Mapped {/v1/me/settings, GET}
Mapped {/v1/me/membership/freeze-request, POST}
Mapped {/v1/me/payments, GET}
Mapped {/v1/me/milestones, GET}
```

---

## Task 11: Mobile — install react-native-calendars

- [ ] **Step 1: Install**

```bash
cd apps/member-app && npx expo install react-native-calendars
```

- [ ] **Step 2: Commit package changes**

```bash
git add apps/member-app/package.json apps/member-app/pnpm-lock.yaml
git commit -m "chore: add react-native-calendars for heatmap"
```

---

## Task 12: Mobile — Activity screen calendar heatmap

**Files:**
- Modify: `apps/member-app/app/(tabs)/activity.tsx`

- [ ] **Step 1: Read existing activity screen**

Read `apps/member-app/app/(tabs)/activity.tsx`

- [ ] **Step 2: Add heatmap toggle + calendar view**

At the top of the screen, add a toggle button. When in calendar mode, render the heatmap instead of the list:

```tsx
import { useState } from 'react';
import { CalendarList } from 'react-native-calendars';

// Inside component, add:
const [view, setView] = useState<'list' | 'calendar'>('list');

// Build marked dates from activity data
const markedDates = useMemo(() => {
  const marks: Record<string, any> = {};
  for (const item of activityItems) { // existing data
    const dateKey = item.date.slice(0, 10); // 'YYYY-MM-DD'
    const count = (marks[dateKey]?.count ?? 0) + 1;
    marks[dateKey] = {
      count,
      selected: true,
      selectedColor: count >= 3 ? colors.primaryDark
                   : count === 2 ? colors.primary
                   : colors.primary + '80',
    };
  }
  return marks;
}, [activityItems]);

// Toggle button (add to header row):
<Pressable
  style={[toggleStyle, view === 'calendar' && toggleActiveStyle]}
  onPress={() => setView(v => v === 'list' ? 'calendar' : 'list')}
>
  <Ionicons name={view === 'calendar' ? 'list-outline' : 'calendar-outline'} size={18} color={view === 'calendar' ? '#fff' : colors.primary} />
</Pressable>

// Conditional render:
{view === 'calendar' ? (
  <CalendarList
    markedDates={markedDates}
    markingType="custom"
    pastScrollRange={6}
    futureScrollRange={0}
    scrollEnabled
    showScrollIndicator
    theme={{
      backgroundColor: colors.bg,
      calendarBackground: colors.bg,
      selectedDayBackgroundColor: colors.primary,
      todayTextColor: colors.primary,
      dayTextColor: colors.text,
      textDisabledColor: colors.border,
      monthTextColor: colors.text,
      textMonthFontFamily: fonts.bold,
      textDayFontFamily: fonts.regular,
    }}
  />
) : (
  // existing list render
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/member-app/app/"(tabs)"/activity.tsx
git commit -m "feat: activity screen calendar heatmap toggle view"
```

---

## Task 13: Mobile — Favourites screen + star button on classes

**Files:**
- Create: `apps/member-app/app/favourites.tsx`
- Modify: `apps/member-app/app/(tabs)/classes.tsx`

- [ ] **Step 1: Favourites screen**

```tsx
// apps/member-app/app/favourites.tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';

interface Favourite { id: string; classTemplateId: string; className: string; instructorName: string | null }

export default function FavouritesScreen() {
  const router = useRouter();
  const [favs, setFavs]       = useState<Favourite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<Favourite[]>('/me/favourites');
      setFavs(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    await apiClient.delete(`/me/favourites/${id}`);
    setFavs(f => f.filter(x => x.id !== id));
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Favourite Classes</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={favs}
          keyExtractor={f => f.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="star-outline" size={48} color={colors.border} />
              <Text style={s.emptyTitle}>No favourites yet</Text>
              <Text style={s.emptySub}>Star a class from the schedule to save it here</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardIcon}>
                <Ionicons name="fitness-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.className}>{item.className}</Text>
                {item.instructorName && <Text style={s.instructor}>{item.instructorName}</Text>}
              </View>
              <Pressable onPress={() => remove(item.id)} hitSlop={8}>
                <Ionicons name="star" size={22} color={colors.amber} />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title:  { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  list:   { padding: 16, gap: 10, paddingBottom: 40 },
  card:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardIcon:{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  className: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
  instructor:{ fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  empty:  { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle:{ fontSize: 16, fontFamily: fonts.bold, color: colors.textMuted },
  emptySub:  { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
```

- [ ] **Step 2: Add ⭐ star button to classes.tsx**

In each class row in `classes.tsx`, after reading the file, add a star icon button:

```tsx
// In class row render, add a star button:
<Pressable onPress={() => toggleFavourite(cls)} hitSlop={8}>
  <Ionicons
    name={favouriteIds.has(cls.id) ? 'star' : 'star-outline'}
    size={20}
    color={favouriteIds.has(cls.id) ? colors.amber : colors.textMuted}
  />
</Pressable>

// Add state and toggle function to the screen:
const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());

useEffect(() => {
  apiClient.get<{ classTemplateId: string }[]>('/me/favourites').then(({ data }) => {
    setFavouriteIds(new Set(data.map(f => f.classTemplateId)));
  }).catch(() => {});
}, []);

const toggleFavourite = async (cls: ClassItem) => {
  if (favouriteIds.has(cls.id)) {
    await apiClient.delete(`/me/favourites/${cls.id}`).catch(() => {});
    setFavouriteIds(s => { const n = new Set(s); n.delete(cls.id); return n; });
  } else {
    await apiClient.post('/me/favourites', { classTemplateId: cls.id, className: cls.name }).catch(() => {});
    setFavouriteIds(s => new Set(s).add(cls.id));
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/member-app/app/favourites.tsx apps/member-app/app/"(tabs)"/classes.tsx
git commit -m "feat: favourites screen + star button on class schedule"
```

---

## Task 14: Mobile — Freeze request form

**Files:**
- Create: `apps/member-app/app/membership/freeze.tsx`

- [ ] **Step 1: Create freeze form screen**

```tsx
// apps/member-app/app/membership/freeze.tsx
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

const REASONS = ['Travel', 'Medical', 'Personal'];

export default function FreezeScreen() {
  const router = useRouter();
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [reason,    setReason]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(endDate) &&
    reason.length > 0;

  const submit = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/me/membership/freeze-request', { startDate, endDate, reason });
      Alert.alert('Request Submitted', 'Your freeze request has been submitted. Staff will review within 2 business days.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not submit request. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Freeze Membership</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.blue} />
            <Text style={s.infoText}>Maximum freeze period is 90 days. Staff will review within 2 business days.</Text>
          </View>

          <Text style={s.label}>Start Date</Text>
          <TextInput style={s.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>End Date</Text>
          <TextInput style={s.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>Reason</Text>
          <View style={s.reasonRow}>
            {REASONS.map(r => (
              <Pressable key={r} style={[s.reasonChip, reason === r && s.reasonChipActive]} onPress={() => setReason(r)}>
                <Text style={[s.reasonText, reason === r && s.reasonTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={[s.btn, (!valid || submitting) && s.btnDisabled]} onPress={submit} disabled={!valid || submitting}>
            <Text style={s.btnTxt}>{submitting ? 'Submitting...' : 'Submit Request'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title:  { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  infoCard: { flexDirection: 'row', gap: 10, backgroundColor: colors.blueBg, borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, color: colors.blue, fontFamily: fonts.regular, lineHeight: 18 },
  label: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  input: { backgroundColor: colors.card, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: fonts.regular, color: colors.text, borderWidth: 1, borderColor: colors.border },
  reasonRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  reasonChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  reasonChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  reasonText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textMuted },
  reasonTextActive: { color: colors.primary },
  btn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnTxt: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/membership/
git commit -m "feat: freeze membership request form"
```

---

## Task 15: Mobile — Payment history screen

**Files:**
- Create: `apps/member-app/app/payments/history.tsx`

- [ ] **Step 1: Create screen**

```tsx
// apps/member-app/app/payments/history.tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { apiClient, API_BASE } from '../../src/api/client';
import { tokenStorage } from '../../src/auth/storage';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

interface PaymentRecord {
  id: string; source: 'app' | 'pgm'; date: string;
  amountHkd: number; description: string; status: string; invoiceAvailable: boolean;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<PaymentRecord[]>('/me/payments');
      setPayments(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const downloadInvoice = async (id: string) => {
    if (Platform.OS === 'web') {
      const token = await tokenStorage.getAccess();
      window.open(`${API_BASE}/me/payments/${id}/invoice?token=${token}`, '_blank');
      return;
    }
    setDownloading(id);
    try {
      const token = await tokenStorage.getAccess();
      const path  = `${FileSystem.cacheDirectory}go24-invoice-${id}.pdf`;
      await FileSystem.downloadAsync(`${API_BASE}/me/payments/${id}/invoice`, path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await Sharing.shareAsync(path, { mimeType: 'application/pdf' });
    } catch {
      // alert handled by user
    } finally { setDownloading(null); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Payment History</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={payments}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={48} color={colors.border} />
              <Text style={s.emptyTitle}>No payments yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardLeft}>
                <Text style={s.desc}>{item.description}</Text>
                <Text style={s.date}>{fmtDate(item.date)}</Text>
              </View>
              <View style={s.cardRight}>
                <Text style={s.amount}>HK${item.amountHkd.toFixed(2)}</Text>
                {item.invoiceAvailable && (
                  <Pressable
                    onPress={() => downloadInvoice(item.id)}
                    disabled={downloading === item.id}
                    style={s.dlBtn}
                  >
                    {downloading === item.id
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Ionicons name="download-outline" size={16} color={colors.primary} />
                    }
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title:  { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  list:   { padding: 16, gap: 10, paddingBottom: 40 },
  card:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardLeft:  { flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  desc:   { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  date:   { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 3 },
  amount: { fontSize: 16, fontFamily: fonts.black, color: colors.primary },
  dlBtn:  { padding: 4 },
  empty:  { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textMuted },
});
```

- [ ] **Step 2: Install expo-file-system + expo-sharing if not already installed**

```bash
cd apps/member-app && npx expo install expo-file-system expo-sharing
```

- [ ] **Step 3: Commit**

```bash
git add apps/member-app/app/payments/
git commit -m "feat: payment history screen + PDF invoice download"
```

---

## Task 16: Mobile — Profile links + Home streak

**Files:**
- Modify: `apps/member-app/app/profile.tsx`
- Modify: `apps/member-app/app/(tabs)/index.tsx`

- [ ] **Step 1: Add links to profile.tsx LINKS array**

In `profile.tsx`, find the `LINKS` array and add:

```tsx
{ icon: 'snow-outline'    as const, label: 'Freeze Membership',  to: '/membership/freeze' },
{ icon: 'receipt-outline' as const, label: 'Payment History',    to: '/payments/history'  },
{ icon: 'star-outline'    as const, label: 'Favourite Classes',  to: '/favourites'        },
{ icon: 'trophy-outline'  as const, label: 'Achievements',       to: '/milestones'        },
```

- [ ] **Step 2: Add streak to DashboardData interface in index.tsx**

```tsx
// In DashboardData interface:
streak: number;

// In StatRow call, change to show streak instead of classes or add 4th stat:
// Replace one stat or add streak display below membership card
```

Add streak display below membership card:

```tsx
{data && data.streak > 0 && (
  <View style={s.streakBanner}>
    <Text style={s.streakEmoji}>🔥</Text>
    <Text style={s.streakText}>{data.streak}-week streak — keep it up!</Text>
  </View>
)}
```

Add styles:
```tsx
streakBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, backgroundColor: colors.amberBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
streakEmoji:  { fontSize: 18 },
streakText:   { fontSize: 13, fontFamily: fonts.semibold, color: colors.amber },
```

- [ ] **Step 3: Commit**

```bash
git add apps/member-app/app/profile.tsx apps/member-app/app/"(tabs)"/index.tsx
git commit -m "feat: profile links for freeze/history/favourites + home streak banner"
```

---

## Task 17: Final deploy + smoke tests

- [ ] **Step 1: Push and deploy**

```bash
git push origin main
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "cd /opt/go24 && git pull origin main && \
   docker compose -f infra/droplet/docker-compose.prod.yml up -d --build api && \
   sleep 15 && docker logs go24-api --tail 10"
```

- [ ] **Step 2: Test favourites**

```bash
TOKEN=$(curl -s -X POST https://api-staging.go24fitness.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@go24.fitness","password":"testpass"}' | jq -r .accessToken)

curl -s -H "Authorization: Bearer $TOKEN" \
  https://api-staging.go24fitness.com/v1/me/favourites
```

Expected: `[]`

- [ ] **Step 3: Test settings**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api-staging.go24fitness.com/v1/me/settings
```

Expected: `{"userId":"...","reminderMinutes":60,"autoWaitlistCancel":false}`

- [ ] **Step 4: Test payment history**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api-staging.go24fitness.com/v1/me/payments
```

Expected: JSON array (may be empty on staging)

- [ ] **Step 5: Mobile reload**

Hard refresh `http://192.168.1.228:8081`  
Profile screen → new links: Freeze Membership, Payment History, Favourite Classes  
Activity screen → calendar toggle button visible  
Home screen → streak banner (if streak > 0)

---

## Phase 3 (future plan)

Covers: Admin Banner interface, EAS Build (.apk), Trainer App
