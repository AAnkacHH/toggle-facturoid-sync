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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  clientMappingId: string;

  @Column({ type: 'smallint', nullable: false })
  periodYear: number;

  @Column({ type: 'smallint', nullable: false })
  periodMonth: number;

  @Column({ type: 'bigint', nullable: true })
  fakturoidInvoiceId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fakturoidNumber: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: false })
  totalHours: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  totalAmount: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
    nullable: false,
  })
  status: InvoiceStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(
    () => ClientMapping,
    (clientMapping) => clientMapping.invoiceLogs,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'clientMappingId' })
  clientMapping: ClientMapping;
}
