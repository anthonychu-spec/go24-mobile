import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { SessionValidator } from '../auth/session-validator';
import { Session } from '../auth/entities/session.entity';
import { User } from '../auth/entities/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingEvent } from '../bookings/entities/booking-event.entity';
import { IdempotencyKey } from '../bookings/entities/idempotency-key.entity';
import { ACCOUNT_DELETED, CANCEL_UNKNOWN } from '../bookings/booking.service';
import { UserFavourite } from '../favourites/entities/user-favourite.entity';
import { MembershipRequest } from '../membership-requests/entities/membership-request.entity';
import { MemberMilestone } from '../milestones/entities/member-milestone.entity';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PaymentMethod } from '../payments/entities/payment-method.entity';
import { PtLog } from '../pt/entities/pt-log.entity';
import { Referral } from '../referral/entities/referral.entity';
import { UserSettings } from '../settings/entities/user-settings.entity';
import { CoachingEnquiry } from '../coaching/coaching-enquiry.entity';
import { FaceEnrollment } from '../signup/entities/face-enrollment.entity';

/** booking_events.actor written in place of the member's user id */
export const DELETED_ACTOR = 'deleted_user';

/** Keys removed from outbox payloads that belong to the member's bookings */
const OUTBOX_PERSONAL_KEYS = ['userId', 'pgmMemberId', 'pgmId', 'email', 'phone', 'name'];

/** Rows owned by the member that are deleted outright */
const OWNED_TABLES = [
  Session, DeviceToken, Notification, UserSettings, UserFavourite, IdempotencyKey,
  MemberMilestone, MembershipRequest, PaymentMethod, FaceEnrollment, CoachingEnquiry,
] as const;

export interface DeletionResult {
  /** false when there was no (or no longer an) app account to delete */
  deleted: boolean;
}

/**
 * Deletes a member's app account (backend-plan N4). One local user is shared by
 * every brand app, so this removes the account from all of them.
 *
 * - Deleted: sessions (which ends every access token), push tokens, inbox,
 *   settings, favourites, idempotency records, milestones, freeze requests,
 *   saved-card references, face-enrolment photo, coaching enquiries, referrals
 *   the member made.
 * - De-identified, rows kept: bookings (no PGM member id; the PGM booking id
 *   stays, a confirmed booking must have one and PGM keeps the member anyway),
 *   booking_events (actor), outbox payloads, PT logs (signature and notes),
 *   referrals that name the member as the referred user.
 * - `users` row kept as a tombstone: status 'deleted', every identifier cleared.
 * - Left alone: PGM (membership, PGM bookings, PGM profile) and `charges`,
 *   which are payment records.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly sessionValidator: SessionValidator,
  ) {}

  async deleteUser(userId: string): Promise<DeletionResult> {
    const sessionIds = await this.dataSource.transaction(async em => {
      const user = await em.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user || user.status === 'deleted') return null;
      const sessions = await em.find(Session, { where: { userId }, select: { id: true } });
      await this.wipe(em, userId);
      return sessions.map(s => s.id);
    });
    if (!sessionIds) return { deleted: false };

    // After commit, so a request in between can't cache the session as live again
    for (const id of sessionIds) this.sessionValidator.forget(id);
    this.logger.log({ event: 'account_deleted', userId, sessions: sessionIds.length });
    return { deleted: true };
  }

  /** Web flow: the member proved who they are with a PGM one-time code. */
  async deleteByPgmMemberId(pgmMemberId: number): Promise<DeletionResult> {
    const user = await this.dataSource.getRepository(User).findOne({ where: { pgmMemberId } });
    if (!user) return { deleted: false };
    return this.deleteUser(user.id);
  }

  private async wipe(em: EntityManager, userId: string): Promise<void> {
    for (const entity of OWNED_TABLES) await em.delete(entity, { userId });

    await em.delete(Referral, { referrerId: userId });
    await em.update(Referral, { referredUserId: userId }, { referredUserId: null });

    await em.update(PtLog, { userId }, { signature: '', notes: null });

    // Outbox rows only carry booking ids today; strip personal keys in case a topic adds them
    await em.query(
      `UPDATE outbox_events SET payload = payload - $2::text[]
       WHERE payload->>'userId' = $1::text
          OR payload->>'bookingId' IN (SELECT id::text FROM bookings WHERE user_id = $1::uuid)`,
      [userId, OUTBOX_PERSONAL_KEYS],
    );
    await em.update(BookingEvent, { actor: userId }, { actor: DELETED_ACTOR });

    // Unsettled bookings lose their PGM member id below, so ReconcileJob can't check them
    await em.update(Booking, { userId, status: In(['pending', 'pending_verify']) }, { errorCode: ACCOUNT_DELETED });
    await em.update(Booking, { userId, errorCode: CANCEL_UNKNOWN }, { errorCode: ACCOUNT_DELETED });
    await em.update(Booking, { userId }, { pgmMemberId: null });

    await em.update(User, { id: userId }, {
      status: 'deleted',
      email: null,
      phone: null,
      pgmMemberId: null,
      memberCode: null,
      trainerCode: null,
      lastPgmSyncAt: null,
      deletedAt: new Date(),
    });
  }
}
