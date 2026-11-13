import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Patient, PatientDetail, QueueEntry, UserSummary, VisitDetail } from '@swasthyaiq/shared';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators';
import { ClinicService } from './clinic.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly clinic: ClinicService) {}

  /** Any signed-in user (doctor or admin). The app calls this right after login. */
  @Get()
  me(@CurrentUser() user: AuthUser): Promise<UserSummary> {
    return this.clinic.me(user);
  }
}

/** Endpoints for the Android app — doctor role only. */
@ApiTags('clinic')
@ApiBearerAuth()
@Roles('doctor')
@Controller()
export class ClinicController {
  constructor(private readonly clinic: ClinicService) {}

  @Get('queue')
  queue(@CurrentUser() user: AuthUser): Promise<QueueEntry[]> {
    return this.clinic.queue(user);
  }

  @Post('queue/:patientId/open')
  open(
    @CurrentUser() user: AuthUser,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query('force') force?: string,
  ): Promise<QueueEntry> {
    return this.clinic.openConsult(user, patientId, force === 'true');
  }

  @Get('patients')
  search(@Query('q') q = ''): Promise<Patient[]> {
    return this.clinic.searchPatients(q);
  }

  @Get('patients/:id')
  patient(@Param('id', new ParseUUIDPipe()) id: string): Promise<PatientDetail> {
    return this.clinic.patient(id);
  }

  @Get('patients/:id/labs/:testCode/trend')
  trend(@Param('id', new ParseUUIDPipe()) id: string, @Param('testCode') testCode: string) {
    return this.clinic.labTrend(id, testCode);
  }

  @Get('visits/:id')
  visit(@Param('id', new ParseUUIDPipe()) id: string): Promise<VisitDetail> {
    return this.clinic.visit(id);
  }
}
