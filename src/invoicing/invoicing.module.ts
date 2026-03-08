import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceConfig } from './entities/service-config.entity';
import { ClientMapping } from './entities/client-mapping.entity';
import { TimeReport } from './entities/time-report.entity';
import { InvoiceLog } from './entities/invoice-log.entity';
import { EncryptionService } from './services/encryption.service';
import { TogglClientService } from './services/toggl-client.service';
import { FakturoidClientService } from './services/fakturoid-client.service';
import { InvoicingService } from './services/invoicing.service';
import { InvoiceCronService } from './services/invoice-cron.service';
import { ServiceConfigService } from './services/service-config.service';
import { ServiceConfigController } from './controllers/service-config.controller';
import { ClientMappingController } from './controllers/client-mapping.controller';
import { InvoicingController } from './controllers/invoicing.controller';
import { ClientMappingService } from './services/client-mapping.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceConfig,
      ClientMapping,
      TimeReport,
      InvoiceLog,
    ]),
  ],
  controllers: [
    ServiceConfigController,
    ClientMappingController,
    InvoicingController,
  ],
  providers: [
    EncryptionService,
    TogglClientService,
    FakturoidClientService,
    InvoicingService,
    InvoiceCronService,
    ServiceConfigService,
    ClientMappingService,
  ],
  exports: [
    TypeOrmModule,
    EncryptionService,
    TogglClientService,
    FakturoidClientService,
    InvoicingService,
    InvoiceCronService,
    ServiceConfigService,
  ],
})
export class InvoicingModule {}
