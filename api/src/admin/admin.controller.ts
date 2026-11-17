import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
  SetMetadata,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators';
import { AUDIT_ACTION } from '../audit/audit.interceptor';
import { AuditService } from '../audit/audit.service';
import { AdminService } from './admin.service';

const Audit = (action: string) => SetMetadata(AUDIT_ACTION, action);

/** Endpoints for the web Admin dashboard — admin role only. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  users() {
    return this.admin.listUsers();
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('audit')
  auditLog(@Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number) {
    return this.audit.list(limit); // a non-number limit is a 400, not a database error
  }

  @Post('queue/reset')
  @HttpCode(200)
  @Audit('queue.reset')
  resetQueue() {
    return this.admin.resetQueue();
  }

  @Post('test-visits/clear')
  @HttpCode(200)
  @Audit('visits.clear_test')
  clearTestVisits() {
    return this.admin.clearTestVisits();
  }

  @Post('users/:username/sign-out')
  @HttpCode(200)
  @Audit('user.remote_sign_out')
  signOut(@CurrentUser() admin: AuthUser, @Param('username') username: string) {
    return this.admin.signOut(admin, username);
  }

  @Put('users/:username/enabled')
  @Audit('user.set_enabled')
  setEnabled(@Param('username') username: string, @Body('enabled', ParseBoolPipe) enabled: boolean) {
    return this.admin.setEnabled(username, enabled);
  }
}
