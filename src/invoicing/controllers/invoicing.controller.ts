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
  generate(@Body() dto: GenerateInvoicesDto) {
    return this.invoicingService.generateMonthlyInvoices(dto.year, dto.month);
  }

  @Get('preview/:year/:month')
  preview(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.invoicingService.getMonthPreview(year, month);
  }

  @Post('reports/fetch')
  @HttpCode(HttpStatus.OK)
  fetchReports(@Body() dto: GenerateInvoicesDto): Promise<TimeReport[]> {
    return this.invoicingService.fetchAndSaveTimeReports(dto.year, dto.month);
  }

  @Get('toggl/clients')
  getTogglClients(): Promise<TogglClient[]> {
    return this.togglClient.getClients();
  }

  @Get('toggl/projects')
  getTogglProjects(): Promise<TogglProject[]> {
    return this.togglClient.getProjects();
  }

  @Get('fakturoid/subjects')
  async getFakturoidSubjects(): Promise<FakturoidSubject[]> {
    const slug = await this.invoicingService.getFakturoidSlug();
    return this.fakturoidClient.getSubjects(slug);
  }

  @Get('time-reports')
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
      if (
        Object.values(InvoiceStatus).includes(status as InvoiceStatus)
      ) {
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
  async getInvoiceLog(@Param('id') id: string): Promise<InvoiceLog> {
    const log = await this.invoiceLogRepo.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException(`InvoiceLog with id="${id}" not found`);
    }
    return log;
  }
}
