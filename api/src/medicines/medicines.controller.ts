import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MedicineCatalogue, MedicineFavourite } from '@swasthyaiq/shared';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators';
import { MedicinesService } from './medicines.service';

/** Medicine catalogue, order sets and favourites for the prescription builder (DIG-69). */
@ApiTags('medicines')
@ApiBearerAuth()
@Roles('doctor')
@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicines: MedicinesService) {}

  /** Catalogue (doctor's specialty first) and the doctor's order sets. Indicative only. */
  @Get()
  catalogue(@CurrentUser() user: AuthUser): Promise<MedicineCatalogue> {
    return this.medicines.catalogue(user);
  }

  /** The signed-in doctor's most-prescribed catalogue medicines. */
  @Get('favourites')
  favourites(@CurrentUser() user: AuthUser): Promise<MedicineFavourite[]> {
    return this.medicines.favourites(user);
  }
}
