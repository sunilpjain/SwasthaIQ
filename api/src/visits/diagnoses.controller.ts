import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { DiagnosisFavourite } from '@swasthyaiq/shared';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators';
import { VisitsService } from './visits.service';

/** Diagnosis picker support (DIG-53). Doctor role only. */
@ApiTags('visits')
@ApiBearerAuth()
@Roles('doctor')
@Controller('diagnoses')
export class DiagnosesController {
  constructor(private readonly visits: VisitsService) {}

  /** The signed-in doctor's most-used diagnoses, shown first in the picker. */
  @Get('favourites')
  favourites(@CurrentUser() user: AuthUser): Promise<DiagnosisFavourite[]> {
    return this.visits.favourites(user);
  }
}
