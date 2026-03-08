import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TimeReport } from './time-report.entity';
import { InvoiceLog } from './invoice-log.entity';

@Entity('client_mapping')
export class ClientMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'bigint', unique: true, nullable: false })
  togglClientId: string;

  @Column({ type: 'bigint', nullable: false })
  togglWorkspaceId: string;

  @Column({ type: 'bigint', nullable: false })
  fakturoidSubjectId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  hourlyRate: string;

  @Column({ type: 'varchar', length: 3, nullable: false, default: 'CZK' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => TimeReport, (timeReport) => timeReport.clientMapping)
  timeReports: TimeReport[];

  @OneToMany(() => InvoiceLog, (invoiceLog) => invoiceLog.clientMapping)
  invoiceLogs: InvoiceLog[];
}
