import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AuditService } from './audit/audit.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthService, STATUS_TTL, STATUS_TTL_MS } from './auth/auth.service';
import { CognitoAdmin } from './auth/cognito-admin';
import { TokenVerifier } from './auth/token-verifier';
import { ClinicController, MeController } from './clinic/clinic.controller';
import { ClinicService } from './clinic/clinic.service';
import { QueueResetScheduler } from './clinic/queue-reset.scheduler';
import { DB, type Db } from './db/database';
import { HealthController } from './health/health.controller';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { APP_VERSION } from './tokens';
import { MedicinesController } from './medicines/medicines.controller';
import { MedicinesService } from './medicines/medicines.service';
import { MemoryFileStore, type FileStore } from './files/file-store';
import { InlineJobQueue, type JobQueue } from './jobs/job-queue';
import { FILES, JOBS } from './jobs/tokens';
import { SummaryController } from './summary/summary.controller';
import { SummaryService } from './summary/summary.service';
import { PatientsController } from './patients/patients.controller';
import { PatientsService } from './patients/patients.service';
import { DiagnosesController } from './visits/diagnoses.controller';
import { VisitsController } from './visits/visits.controller';
import { VisitsService } from './visits/visits.service';

export interface AppDeps {
  db: Db;
  verifier: TokenVerifier;
  cognitoAdmin: CognitoAdmin;
  version: string;
  statusTtlMs?: number;
  /** Private files (DIG-72). Defaults to memory (local runs and tests). */
  files?: FileStore;
  /** Background jobs (DIG-72). Defaults to running them in-process straight away. */
  jobs?: JobQueue;
}

/**
 * Root module. External dependencies (DB, token verifier, Cognito admin) are passed in,
 * so main.ts wires the real AWS ones and tests wire local fakes with the same code paths.
 */
@Module({})
export class AppModule {
  static forRoot(deps: AppDeps): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        HealthController,
        MeController,
        ClinicController,
        PatientsController,
        VisitsController,
        DiagnosesController,
        MedicinesController,
        SummaryController,
        AdminController,
      ],
      providers: [
        { provide: DB, useValue: deps.db },
        { provide: TokenVerifier, useValue: deps.verifier },
        { provide: CognitoAdmin, useValue: deps.cognitoAdmin },
        { provide: APP_VERSION, useValue: deps.version },
        { provide: FILES, useValue: deps.files ?? new MemoryFileStore() },
        { provide: JOBS, useValue: deps.jobs ?? new InlineJobQueue() },
        { provide: STATUS_TTL, useValue: deps.statusTtlMs ?? STATUS_TTL_MS },
        AuthService,
        AuditService,
        ClinicService,
        PatientsService,
        VisitsService,
        MedicinesService,
        SummaryService,
        AdminService,
        QueueResetScheduler,
        RealtimeGateway,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
      ],
    };
  }
}
