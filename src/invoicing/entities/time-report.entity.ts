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

@Entity('time_report')
@Unique(['clientMappingId', 'periodYear', 'periodMonth', 'togglProjectId'])
export class TimeReport {
  @ApiProperty({
    description: 'Unique identifier (UUID)',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'Client mapping UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @Column({ type: 'uuid', nullable: false })
  clientMappingId!: string;

  @ApiProperty({ description: 'Period year', example: 2026 })
  @Column({ type: 'smallint', nullable: false })
  periodYear!: number;

  @ApiProperty({ description: 'Period month (1-12)', example: 3 })
  @Column({ type: 'smallint', nullable: false })
  periodMonth!: number;

  @ApiProperty({ description: 'Toggl project ID', example: '11223344' })
  @Column({ type: 'bigint', nullable: false })
  togglProjectId!: string;

  @ApiProperty({
    description: 'Project name from Toggl',
    example: 'Website Redesign',
  })
  @Column({ type: 'varchar', length: 255, nullable: false })
  projectName!: string;

  @ApiProperty({ description: 'Total tracked time in seconds', example: 57780 })
  @Column({ type: 'integer', nullable: false })
  totalSeconds!: number;

  @ApiProperty({ description: 'Total tracked hours', example: '16.05' })
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: false })
  totalHours!: string;

  @ApiProperty({ description: 'Calculated amount', example: '2407.50' })
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  amount!: string;

  @ApiProperty({
    description: 'Timestamp when data was fetched from Toggl',
    example: '2026-03-01T12:00:00.000Z',
  })
  @Column({ type: 'timestamp', nullable: false })
  fetchedAt!: Date;

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
    (clientMapping) => clientMapping.timeReports,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'clientMappingId' })
  clientMapping!: ClientMapping;
}
