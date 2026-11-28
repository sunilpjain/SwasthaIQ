import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { VisitDetail } from '@swasthyaiq/shared';
import { Audit } from '../audit/audit.interceptor';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators';
import { parseAmendment, parseSign, parseDraft } from './visit-input';
import { VisitsService } from './visits.service';

/** Visit and consult note (DIG-41). Doctor role only; every write is audited. */
@ApiTags('visits')
@ApiBearerAuth()
@Roles('doctor')
@Controller('visits')
export class VisitsController {
  constructor(
    private readonly visits: VisitsService,
    private readonly audit: AuditService,
  ) {}

  /** Both doctors can read every visit (prototype rule); opening the other doctor's is audited. */
  @Get(':id')
  async visit(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<VisitDetail> {
    const v = await this.visits.detail(id);
    if (v.doctorId !== user.id) {
      await this.audit.record({
        userId: user.id,
        username: user.username,
        action: 'visit.read_other_doctor',
        entityType: 'visit',
        entityId: id,
        httpMethod: 'GET',
        path: '/visits/:id',
        statusCode: 200,
      });
    }
    return v;
  }

  /** Draft save. The app picks the visit id, so a retried save creates nothing twice. */
  @Put(':id')
  @Audit('visit.save_draft')
  save(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<VisitDetail> {
    return this.visits.saveDraft(user, id, parseDraft(body));
  }

  /** Sign: needs a diagnosis and every dictated or scanned field confirmed. Sets the queue entry to Done. */
  @Post(':id/sign')
  @HttpCode(200)
  @Audit('visit.sign')
  sign(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<VisitDetail> {
    return this.visits.sign(user, id, parseSign(body));
  }

  @Post(':id/amendments')
  @HttpCode(200)
  @Audit('visit.amend')
  amend(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<VisitDetail> {
    return this.visits.amend(user, id, parseAmendment(body));
  }
}
