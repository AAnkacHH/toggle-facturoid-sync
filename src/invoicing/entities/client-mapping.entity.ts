import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Unique identifier (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'Display name for the mapping',
    example: 'Acme Corp',
  })
  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @ApiProperty({ description: 'Toggl client ID', example: '12345678' })
  @Column({ type: 'bigint', unique: true, nullable: false })
  togglClientId!: string;

  @ApiProperty({ description: 'Toggl workspace ID', example: '9876543' })
  @Column({ type: 'bigint', nullable: false })
  togglWorkspaceId!: string;

  @ApiProperty({ description: 'Fakturoid subject ID', example: '123' })
  @Column({ type: 'bigint', nullable: false })
  fakturoidSubjectId!: string;

  @ApiProperty({ description: 'Hourly rate', example: '150.00' })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  hourlyRate!: string;

  @ApiProperty({ description: 'Currency code (ISO 4217)', example: 'CZK' })
  @Column({ type: 'varchar', length: 3, nullable: false, default: 'CZK' })
  currency!: string;

  @ApiProperty({ description: 'Whether the mapping is active', example: true })
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-03-01T12:00:00.000Z',
  })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({
    description: 'Record last update timestamp',
    example: '2026-03-01T12:00:00.000Z',
  })
  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => TimeReport, (timeReport) => timeReport.clientMapping)
  timeReports!: TimeReport[];

  @OneToMany(() => InvoiceLog, (invoiceLog) => invoiceLog.clientMapping)
  invoiceLogs!: InvoiceLog[];
}
