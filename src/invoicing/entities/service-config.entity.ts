import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('service_config')
@Unique(['serviceName', 'configKey'])
export class ServiceConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  serviceName!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  configKey!: string;

  @Column({ type: 'bytea', nullable: true })
  encryptedValue!: Buffer | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  plainValue!: string | null;

  @Column({ type: 'boolean', default: false })
  isSecret!: boolean;

  @Column({ type: 'bytea', nullable: true })
  iv!: Buffer | null;

  @Column({ type: 'bytea', nullable: true })
  authTag!: Buffer | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
