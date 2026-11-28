import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { SummaryDocument } from '@swasthyaiq/shared';
import { Audit } from '../audit/audit.interceptor';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators';
import { parsePrintCopy } from './print-copy-input';
import { SummaryService } from './summary.service';

const pdfFile = (body: Buffer, version: number, edited = false) =>
  new StreamableFile(body, {
    type: 'application/pdf',
    // Ids and the version only in the file name, never the patient's name.
    disposition: `inline; filename="consultation-summary-v${version}${edited ? '-print-copy' : ''}.pdf"`,
    length: body.length,
  });

/** A4 consultation summary with the prescription (DIG-72/73). Doctor role only. */
@ApiTags('visits')
@ApiBearerAuth()
@Roles('doctor')
@Controller('visits')
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  /** The summary as laid out on the A4, for the print-copy editor. */
  @Get(':id/summary')
  document(@Param('id', new ParseUUIDPipe()) id: string): Promise<SummaryDocument> {
    return this.summary.document(id);
  }

  /** The A4 PDF of the latest version (a draft is rendered live and marked as such). */
  @Get(':id/summary.pdf')
  @ApiProduces('application/pdf')
  async pdf(@Param('id', new ParseUUIDPipe()) id: string): Promise<StreamableFile> {
    const { body, version } = await this.summary.pdf(id);
    return pdfFile(body, version);
  }

  /** DIG-73: a reworded printout. Not saved, not written back; audited (no text). */
  @Post(':id/print-copy')
  @HttpCode(200)
  @Audit('visit.print_copy_edit')
  @ApiProduces('application/pdf')
  async printCopy(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<StreamableFile> {
    const input = parsePrintCopy(body);
    return pdfFile(await this.summary.printCopy(user, id, input), input.version, true);
  }
}
