import {
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
import { TimeReport } from '../entities/time-report.entity';
import { InvoiceLog, InvoiceStatus } from '../entities/invoice-log.entity';
import { GenerateInvoicesDto } from '../dto/generate-invoices.dto';

@Controller('api/invoicing')
export class InvoicingController {
  constructor(
    private readonly invoicingService: InvoicingService,
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
      where.status = status as InvoiceStatus;
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
