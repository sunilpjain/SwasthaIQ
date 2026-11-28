import { Inject, Injectable } from '@nestjs/common';
import type { Medicine, MedicineCatalogue, MedicineFavourite, Specialty } from '@swasthyaiq/shared';
import { sql } from 'kysely';
import type { AuthUser } from '../auth/auth.decorators';
import { DB, type Db } from '../db/database';
import { CATALOGUE_NOTE, MEDICINES, ORDER_SETS } from './catalogue';

/** How an Rx line names a catalogue medicine: "pantoprazole 40 mg" (DIG-69/70). */
export const medicineName = (m: Pick<Medicine, 'generic' | 'strength'>) => `${m.generic} ${m.strength}`;

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Medicine catalogue and order sets (DIG-69). */
@Injectable()
export class MedicinesService {
  private readonly byName = new Map(MEDICINES.map((m) => [normalise(medicineName(m)), m]));

  constructor(@Inject(DB) private readonly db: Db) {}

  /** The doctor's specialty list first; the other specialty's medicines are included for search. */
  async catalogue(user: AuthUser): Promise<MedicineCatalogue> {
    const specialty = await this.specialty(user);
    const mine = (s: Specialty) => (specialty ? s === specialty : true);
    return {
      note: CATALOGUE_NOTE,
      medicines: [
        ...MEDICINES.filter((m) => mine(m.specialty)),
        ...MEDICINES.filter((m) => !mine(m.specialty)),
      ],
      orderSets: ORDER_SETS.filter((o) => mine(o.specialty)),
    };
  }

  /**
   * The doctor's most-prescribed catalogue medicines from their own signed prescriptions, most
   * used first, then most recent. Lines that are not in the catalogue are left out.
   */
  async favourites(user: AuthUser, limit = 12): Promise<MedicineFavourite[]> {
    const rows = await sql<{ name: string; uses: string }>`
      SELECT lower(l.medicine_generic) AS name, count(*) AS uses
      FROM rx_lines l
      JOIN prescriptions p ON p.id = l.prescription_id
      JOIN visits v ON v.id = p.visit_id
      WHERE v.doctor_id = ${user.id} AND v.status = 'signed'
      GROUP BY lower(l.medicine_generic)
      ORDER BY count(*) DESC, max(v.visit_date) DESC, 1`.execute(this.db);
    const out: MedicineFavourite[] = [];
    for (const r of rows.rows) {
      const m = this.byName.get(normalise(r.name));
      if (m) out.push({ medicineId: m.id, uses: Number(r.uses) });
      if (out.length >= limit) break;
    }
    return out;
  }

  private async specialty(user: AuthUser): Promise<Specialty | null> {
    const row = await this.db
      .selectFrom('users')
      .select('specialty')
      .where('id', '=', user.id)
      .executeTakeFirst();
    return row?.specialty ?? null;
  }
}
