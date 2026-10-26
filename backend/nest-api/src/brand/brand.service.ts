import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand, BrandClub, BrandFeature } from './brand.entity';
import { BrandId, Feature, FEATURES } from './brand.constants';

const RELOAD_MS = 5 * 60_000;

interface Snapshot {
  brands: Map<string, Brand>;
  clubs: Map<string, Set<number>>;
  features: Map<string, Set<string>>;
  loadedAt: number;
}

export interface AppConfig {
  brand: string;
  name: string;
  minAppVersion: string | null;
  maintenanceMessage: string | null;
  features: Record<Feature, boolean>;
}

/**
 * Brand whitelists (clubs) and feature switches, read from the brand_* tables
 * and cached for 5 minutes. Unknown brand or club → not owned; feature with no
 * row → off.
 */
@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);
  private snapshot: Snapshot | null = null;
  private loading: Promise<Snapshot> | null = null;

  constructor(
    @InjectRepository(Brand) private readonly brands: Repository<Brand>,
    @InjectRepository(BrandClub) private readonly brandClubs: Repository<BrandClub>,
    @InjectRepository(BrandFeature) private readonly brandFeatures: Repository<BrandFeature>,
  ) {}

  async clubIds(brand: BrandId): Promise<number[]> {
    return [...((await this.load()).clubs.get(brand) ?? [])];
  }

  async ownsClub(brand: BrandId, clubId: number | null | undefined): Promise<boolean> {
    if (clubId == null) return false;
    return (await this.load()).clubs.get(brand)?.has(clubId) ?? false;
  }

  /** The brand a PGM club belongs to (first match), or null */
  async brandOfClub(clubId: number): Promise<string | null> {
    for (const [brand, clubs] of (await this.load()).clubs) if (clubs.has(clubId)) return brand;
    return null;
  }

  async isEnabled(brand: BrandId, feature: Feature): Promise<boolean> {
    return (await this.load()).features.get(brand)?.has(feature) ?? false;
  }

  async appConfig(brand: BrandId): Promise<AppConfig> {
    const s = await this.load();
    const b = s.brands.get(brand);
    const on = s.features.get(brand) ?? new Set<string>();
    return {
      brand,
      name: b?.name ?? brand,
      minAppVersion: b?.minAppVersion ?? null,
      maintenanceMessage: b?.maintenanceMessage ?? null,
      features: Object.fromEntries(FEATURES.map(f => [f, on.has(f)])) as Record<Feature, boolean>,
    };
  }

  /** Drop the cache (tests, or after editing brand tables by hand). */
  invalidate(): void {
    this.snapshot = null;
  }

  private async load(): Promise<Snapshot> {
    if (this.snapshot && Date.now() - this.snapshot.loadedAt < RELOAD_MS) return this.snapshot;
    this.loading ??= this.fetch().finally(() => { this.loading = null; });
    try {
      this.snapshot = await this.loading;
    } catch (err) {
      // Keep serving the last good snapshot if the DB hiccups
      if (!this.snapshot) throw err;
      this.logger.warn('Brand reload failed; keeping previous snapshot');
    }
    return this.snapshot;
  }

  private async fetch(): Promise<Snapshot> {
    const [brands, clubs, features] = await Promise.all([
      this.brands.find(),
      this.brandClubs.find(),
      this.brandFeatures.find({ where: { enabled: true } }),
    ]);
    const clubMap = new Map<string, Set<number>>();
    for (const c of clubs) {
      if (!clubMap.has(c.brand)) clubMap.set(c.brand, new Set());
      clubMap.get(c.brand)!.add(c.pgmClubId);
    }
    const featureMap = new Map<string, Set<string>>();
    for (const f of features) {
      if (!featureMap.has(f.brand)) featureMap.set(f.brand, new Set());
      featureMap.get(f.brand)!.add(f.feature);
    }
    return { brands: new Map(brands.map(b => [b.id, b])), clubs: clubMap, features: featureMap, loadedAt: Date.now() };
  }
}
