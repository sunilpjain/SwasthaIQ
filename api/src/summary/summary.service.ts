import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { PrintCopyInput, SummaryDocument } from '@swasthyaiq/shared';
import type { AuthUser } from '../auth/auth.decorators';
import { DB, type Db } from '../db/database';
import type { FileStore } from '../files/file-store';
import type { Job, JobQueue } from '../jobs/job-queue';
import { FILES, JOBS } from '../jobs/tokens';
import { logger } from '../logging/logger';
import { VisitsService } from '../visits/visits.service';
import { renderSummaryPdf } from './pdf';
import { applyPrintCopy, buildSummaryDocument, PrintCopyMismatch } from './summary-document';

export const summaryKey = (visitId: string, version: number) => `visits/${visitId}/summary-v${version}.pdf`;

/**
 * The A4 consultation summary with the prescription (DIG-72/73). Each signed version is rendered
 * once by a background job and kept in the private bucket; a draft is rendered on request for the
 * preview. Print-copy edits are rendered on request and never stored or written back.
 */
@Injectable()
export class SummaryService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly visits: VisitsService,
    @Inject(FILES) private readonly files: FileStore,
    @Inject(JOBS) private readonly jobs: JobQueue,
  ) {}

  onModuleInit(): void {
    this.jobs.start((job) => this.handle(job));
  }

  async onModuleDestroy(): Promise<void> {
    await this.jobs.stop();
  }

  async document(visitId: string): Promise<SummaryDocument> {
    const visit = await this.visits.detail(visitId);
    const [patient, doctor] = await Promise.all([
      this.db
        .selectFrom('patients')
        .select(['full_name', 'age_years', 'sex', 'allergies'])
        .where('id', '=', visit.patientId)
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom('users')
        .select(['display_name', 'specialty', 'qualifications', 'registration_no'])
        .where('id', '=', visit.doctorId)
        .executeTakeFirstOrThrow(),
    ]);
    return buildSummaryDocument(
      visit,
      {
        fullName: patient.full_name,
        ageYears: patient.age_years,
        sex: patient.sex,
        allergies: patient.allergies,
      },
      {
        displayName: doctor.display_name,
        specialty: doctor.specialty,
        qualifications: doctor.qualifications,
        registrationNo: doctor.registration_no,
      },
    );
  }

  /** The PDF of the latest version: stored for a signed visit, rendered live for a draft. */
  async pdf(visitId: string): Promise<{ body: Buffer; version: number }> {
    const doc = await this.document(visitId);
    if (doc.status !== 'signed') return { body: await renderSummaryPdf(doc), version: doc.version };
    return { body: await this.stored(doc), version: doc.version };
  }

  /** DIG-73: the doctor's reworded printout. Only the visit's doctor; never saved. */
  async printCopy(user: AuthUser, visitId: string, input: PrintCopyInput): Promise<Buffer> {
    const doc = await this.document(visitId);
    const visit = await this.db
      .selectFrom('visits')
      .select('doctor_id')
      .where('id', '=', visitId)
      .executeTakeFirstOrThrow();
    if (visit.doctor_id !== user.id) {
      throw new ForbiddenException({
        code: 'not_your_visit',
        message: 'Only the visit’s doctor can edit its print copy',
      });
    }
    try {
      return await renderSummaryPdf(applyPrintCopy(doc, input), { printCopyEdited: true });
    } catch (err) {
      if (err instanceof PrintCopyMismatch) {
        throw new BadRequestException({
          code: 'print_copy_stale',
          message: 'The visit changed; open the print copy again',
        });
      }
      throw err;
    }
  }

  /** Background job: render and keep the summary of a signed version (idempotent). */
  async handle(job: Job): Promise<void> {
    if (job.type !== 'render-summary') return;
    const doc = await this.document(job.visitId);
    // A newer version has its own job; an unsigned visit has nothing to keep.
    if (doc.status !== 'signed' || doc.version !== job.version) return;
    await this.stored(doc);
  }

  private async stored(doc: SummaryDocument): Promise<Buffer> {
    const row = await this.db
      .selectFrom('visit_documents')
      .select('s3_key')
      .where('visit_id', '=', doc.visitId)
      .where('version', '=', doc.version)
      .executeTakeFirst();
    if (row) {
      const body = await this.files.get(row.s3_key);
      if (body) return body;
    }
    const body = await renderSummaryPdf(doc);
    const key = summaryKey(doc.visitId, doc.version);
    await this.files.put(key, body, 'application/pdf');
    await this.db
      .insertInto('visit_documents')
      .values({ visit_id: doc.visitId, version: doc.version, s3_key: key, bytes: body.length })
      .onConflict((oc) => oc.columns(['visit_id', 'version']).doNothing())
      .execute();
    logger.info({ visitId: doc.visitId, version: doc.version, bytes: body.length }, 'summary pdf stored');
    return body;
  }
}
