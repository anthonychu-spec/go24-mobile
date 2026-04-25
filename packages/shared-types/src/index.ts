// Shared DTO types — extended in each stage

export type Role = 'member' | 'trainer' | 'admin';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'waitlist'
  | 'cancelled'
  | 'pending_verify'
  | 'attended'
  | 'no_show';
