import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBasicAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { InvoicingService } from '../services/invoicing.service';
import { TogglClientService } from '../services/toggl-client.service';
import { FakturoidClientService } from '../services/fakturoid-client.service';
import { TimeReport } from '../entities/time-report.entity';
import { InvoiceLog, InvoiceStatus } from '../entities/invoice-log.entity';
import { GenerateInvoicesDto } from '../dto/generate-invoices.dto';
import { TogglClient, TogglProject } from '../dto/toggl-summary.dto';
import { FakturoidSubject } from '../dto/fakturoid-invoice.dto';
import { InvoiceGenerationResultResponseDto } from '../dto/invoice-generation-result-response.dto';
import { MonthPreviewResponseDto } from '../dto/month-preview-response.dto';
import {
  TogglClientResponseDto,
  TogglProjectResponseDto,
} from '../dto/toggl-client-response.dto';
import { FakturoidSubjectResponseDto } from '../dto/fakturoid-subject-response.dto';

@ApiTags('Invoicing')
@ApiBasicAuth()
@Controller('api/invoicing')
export class InvoicingController {
  constructor(
    private readonly invoicingService: InvoicingService,
    private readonly togglClient: TogglClientService,
    private readonly fakturoidClient: FakturoidClientService,
    @InjectRepository(TimeReport)
    private readonly timeReportRepo: Repository<TimeReport>,
    @InjectRepository(InvoiceLog)
    private readonly invoiceLogRepo: Repository<InvoiceLog>,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate monthly invoices',
    description:
      'Fetches Toggl time reports, creates draft invoices in Fakturoid for all active client mappings for the specified month.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice generation results per client',
    type: [InvoiceGenerationResultResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  generate(@Body() dto: GenerateInvoicesDto) {
    return this.invoicingService.generateMonthlyInvoices(dto.year, dto.month);
  }

  @Get('preview/:year/:month')
  @ApiOperation({
    summary: 'Preview invoices for a month',
    description:
      'Shows what invoices would be generated for a given month without actually creating them.',
  })
  @ApiParam({ name: 'year', description: 'Year', example: 2026 })
  @ApiParam({ name: 'month', description: 'Month (1-12)', example: 3 })
  @ApiResponse({
    status: 200,
    description: 'Month preview with per-client breakdown',
    type: MonthPreviewResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  preview(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.invoicingService.getMonthPreview(year, month);
  }

  @Post('reports/fetch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fetch and save time reports from Toggl',
    description:
      'Pulls time tracking data from Toggl for the specified month and saves it to the database.',
  })
  @ApiResponse({
    status: 200,
    description: 'Saved time report records',
    type: [TimeReport],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  fetchReports(@Body() dto: GenerateInvoicesDto): Promise<TimeReport[]> {
    return this.invoicingService.fetchAndSaveTimeReports(dto.year, dto.month);
  }

  @Get('toggl/clients')
  @ApiOperation({
    summary: 'List Toggl clients',
    description:
      'Fetches the list of clients from the configured Toggl workspace.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of Toggl clients',
    type: [TogglClientResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getTogglClients(): Promise<TogglClient[]> {
    return this.togglClient.getClients();
  }

  @Get('toggl/projects')
  @ApiOperation({
    summary: 'List Toggl projects',
    description:
      'Fetches the list of projects from the configured Toggl workspace.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of Toggl projects',
    type: [TogglProjectResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getTogglProjects(): Promise<TogglProject[]> {
    return this.togglClient.getProjects();
  }

  @Get('fakturoid/subjects')
  @ApiOperation({
    summary: 'List Fakturoid subjects',
    description:
      'Fetches the list of subjects (contacts) from the configured Fakturoid account.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of Fakturoid subjects',
    type: [FakturoidSubjectResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFakturoidSubjects(): Promise<FakturoidSubject[]> {
    const slug = await this.invoicingService.getFakturoidSlug();
    return this.fakturoidClient.getSubjects(slug);
  }

  @Get('time-reports')
  @ApiOperation({
    summary: 'List time reports',
    description:
      'Returns saved time reports with optional filtering by year, month, and client mapping.',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    description: 'Filter by period year',
    example: '2026',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Filter by period month (1-12)',
    example: '3',
  })
  @ApiQuery({
    name: 'clientMappingId',
    required: false,
    description: 'Filter by client mapping UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'List of time reports',
    type: [TimeReport],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTimeReports(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('clientMappingId') clientMappingId?: string,
  ): Promise<TimeReport[]> {
    const where: FindOptionsWhere<TimeReport> = {};

    if (year) {
      where.periodYear = parseInt(year, 10);
    }
    if (month) {
      where.periodMonth = parseInt(month, 10);
    }
    if (clientMappingId) {
      where.clientMappingId = clientMappingId;
    }

    return this.timeReportRepo.find({ where });
  }

  @Get('invoice-logs')
  @ApiOperation({
    summary: 'List invoice logs',
    description:
      'Returns invoice log records with optional filtering by year, month, status, and client mapping.',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    description: 'Filter by period year',
    example: '2026',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Filter by period month (1-12)',
    example: '3',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by invoice status',
    enum: InvoiceStatus,
    example: 'created',
  })
  @ApiQuery({
    name: 'clientMappingId',
    required: false,
    description: 'Filter by client mapping UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invoice logs',
    type: [InvoiceLog],
  })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getInvoiceLogs(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('clientMappingId') clientMappingId?: string,
  ): Promise<InvoiceLog[]> {
    const where: FindOptionsWhere<InvoiceLog> = {};

    if (year) {
      where.periodYear = parseInt(year, 10);
    }
    if (month) {
      where.periodMonth = parseInt(month, 10);
    }
    if (status) {
      if (Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
        where.status = status as InvoiceStatus;
      } else {
        throw new BadRequestException(
          `Invalid status. Must be one of: ${Object.values(InvoiceStatus).join(', ')}`,
        );
      }
    }
    if (clientMappingId) {
      where.clientMappingId = clientMappingId;
    }

    return this.invoiceLogRepo.find({ where });
  }

  @Get('invoice-logs/:id')
  @ApiOperation({
    summary: 'Get a single invoice log by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the invoice log',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice log found',
    type: InvoiceLog,
  })
  @ApiResponse({ status: 404, description: 'Invoice log not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getInvoiceLog(@Param('id') id: string): Promise<InvoiceLog> {
    const log = await this.invoiceLogRepo.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException(`InvoiceLog with id="${id}" not found`);
    }
    return log;
  }
}
