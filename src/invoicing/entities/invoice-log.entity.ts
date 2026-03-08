import { ApiProperty } from '@nestjs/swagger';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ClientMapping } from './client-mapping.entity';

export enum InvoiceStatus {
  PENDING = 'pending',
  CREATED = 'created',
  SENT = 'sent',
  PAID = 'paid',
  ERROR = 'error',
}

@Entity('invoice_log')
@Unique(['clientMappingId', 'periodYear', 'periodMonth'])
export class InvoiceLog {
  @ApiProperty({
    description: 'Unique identifier',
    example: 1,
  })
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @ApiProperty({
    description: 'Client mapping ID',
    example: 1,
  })
  @Column({ type: 'int', nullable: false })
  clientMappingId!: number;

  @ApiProperty({ description: 'Period year', example: 2026 })
  @Column({ type: 'smallint', nullable: false })
  periodYear!: number;

  @ApiProperty({ description: 'Period month (1-12)', example: 3 })
  @Column({ type: 'smallint', nullable: false })
  periodMonth!: number;

  @ApiProperty({
    description: 'Fakturoid invoice ID',
    example: '12345',
    nullable: true,
  })
  @Column({ type: 'bigint', nullable: true })
  fakturoidInvoiceId!: string | null;

  @ApiProperty({
    description: 'Fakturoid invoice number',
    example: '2026-0001',
    nullable: true,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  fakturoidNumber!: string | null;

  @ApiProperty({ description: 'Total hours billed', example: '160.50' })
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: false })
  totalHours!: string;

  @ApiProperty({ description: 'Total amount billed', example: '24075.00' })
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  totalAmount!: string;

  @ApiProperty({
    description: 'Invoice status',
    enum: InvoiceStatus,
    example: InvoiceStatus.CREATED,
  })
  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
    nullable: false,
  })
  status!: InvoiceStatus;

  @ApiProperty({
    description: 'Error message if invoice creation failed',
    example: null,
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

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

  @ManyToOne(
    () => ClientMapping,
    (clientMapping) => clientMapping.invoiceLogs,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'client_mapping_id' })
  clientMapping!: ClientMapping;
}
