import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { VisitDetail } from '@swasthyaiq/shared';
import { Audit } from '../audit/audit.interceptor';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators';
import { parseAmendment, parseDraft } from './visit-input';
import { VisitsService } from './visits.service';

/** Visit and consult note (DIG-41). Doctor role only; every write is audited. */
@ApiTags('visits')
@ApiBearerAuth()
@Roles('doctor')
@Controller('visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get(':id')
  visit(@Param('id', new ParseUUIDPipe()) id: string): Promise<VisitDetail> {
    return this.visits.detail(id);
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
  sign(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string): Promise<VisitDetail> {
    return this.visits.sign(user, id);
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
