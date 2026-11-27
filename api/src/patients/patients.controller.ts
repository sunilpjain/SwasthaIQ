import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AllergyList, Patient, PatientCondition, PatientDetail } from '@swasthyaiq/shared';
import { Audit } from '../audit/audit.interceptor';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators';
import { parseAllergyInput, parseConditionInput, parseConditionUpdate } from './condition-input';
import { PatientsService } from './patients.service';

/** Patient search, summary, history and conditions (DIG-40). Doctor role only. */
@ApiTags('patients')
@ApiBearerAuth()
@Roles('doctor')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  search(@Query('q') q = ''): Promise<Patient[]> {
    return this.patients.searchPatients(q);
  }

  /** Summary and visits; `doctorId` narrows the visit list to one doctor. */
  @Get(':id')
  patient(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('doctorId') doctorId?: string,
  ): Promise<PatientDetail> {
    return this.patients.patient(id, doctorId);
  }

  @Get(':id/labs/:testCode/trend')
  trend(@Param('id', new ParseUUIDPipe()) id: string, @Param('testCode') testCode: string) {
    return this.patients.labTrend(id, testCode);
  }

  @Post(':id/conditions')
  @Audit('condition.add')
  addCondition(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<PatientCondition> {
    return this.patients.addCondition(user, id, parseConditionInput(body));
  }

  /** DIG-99: add an allergy picked or typed in the consult to the patient's list. */
  @Post(':id/allergies')
  @Audit('allergy.add')
  addAllergy(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown): Promise<AllergyList> {
    return this.patients.addAllergy(id, parseAllergyInput(body).name);
  }

  @Patch(':id/conditions/:conditionId')
  @Audit('condition.update_status')
  updateCondition(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('conditionId', new ParseUUIDPipe()) conditionId: string,
    @Body() body: unknown,
  ): Promise<PatientCondition> {
    return this.patients.updateCondition(user, id, conditionId, parseConditionUpdate(body));
  }
}
