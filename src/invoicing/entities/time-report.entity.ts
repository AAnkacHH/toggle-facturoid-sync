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

@Entity('time_report')
@Unique(['clientMappingId', 'periodYear', 'periodMonth', 'togglProjectId'])
export class TimeReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  clientMappingId: string;

  @Column({ type: 'smallint', nullable: false })
  periodYear: number;

  @Column({ type: 'smallint', nullable: false })
  periodMonth: number;

  @Column({ type: 'bigint', nullable: false })
  togglProjectId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  projectName: string;

  @Column({ type: 'integer', nullable: false })
  totalSeconds: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: false })
  totalHours: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  amount: string;

  @Column({ type: 'timestamp', nullable: false })
  fetchedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(
    () => ClientMapping,
    (clientMapping) => clientMapping.timeReports,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'clientMappingId' })
  clientMapping: ClientMapping;
}
