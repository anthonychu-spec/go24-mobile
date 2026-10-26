import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('brands')
export class Brand {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Oldest app version allowed to run (semver); null = no minimum */
  @Column({ name: 'min_app_version', type: 'varchar', length: 20, nullable: true })
  minAppVersion: string | null;

  /** When set, the app shows this and blocks use (maintenance) */
  @Column({ name: 'maintenance_message', type: 'text', nullable: true })
  maintenanceMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** Which PGM clubs a brand's app shows and may book at */
@Entity('brand_clubs')
export class BrandClub {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  brand: string;

  @PrimaryColumn({ name: 'pgm_club_id', type: 'int' })
  pgmClubId: number;
}

@Entity('brand_features')
export class BrandFeature {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  brand: string;

  @PrimaryColumn({ type: 'varchar', length: 40 })
  feature: string;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;
}
