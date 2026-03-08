import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientMapping } from '../entities/client-mapping.entity';
import { CreateClientMappingDto } from '../dto/create-client-mapping.dto';
import { UpdateClientMappingDto } from '../dto/update-client-mapping.dto';
import { INVOICE_DEFAULTS } from '../constants';

@Injectable()
export class ClientMappingService {
  constructor(
    @InjectRepository(ClientMapping)
    private readonly repo: Repository<ClientMapping>,
  ) {}

  async create(dto: CreateClientMappingDto): Promise<ClientMapping> {
    const existing = await this.repo.findOne({
      where: { togglClientId: String(dto.togglClientId) },
    });
    if (existing) {
      throw new ConflictException(
        `ClientMapping with togglClientId=${dto.togglClientId} already exists`,
      );
    }

    const entity = this.repo.create({
      name: dto.name,
      togglClientId: String(dto.togglClientId),
      togglWorkspaceId: String(dto.togglWorkspaceId),
      fakturoidSubjectId: String(dto.fakturoidSubjectId),
      hourlyRate: String(dto.hourlyRate),
      currency: dto.currency ?? INVOICE_DEFAULTS.DEFAULT_CURRENCY,
      isActive: dto.isActive ?? true,
    });

    return this.repo.save(entity);
  }

  async findAll(active?: string): Promise<ClientMapping[]> {
    if (active === 'true') {
      return this.repo.find({ where: { isActive: true } });
    }
    if (active === 'false') {
      return this.repo.find({ where: { isActive: false } });
    }
    return this.repo.find();
  }

  async findOne(id: number): Promise<ClientMapping> {
    const mapping = await this.repo.findOne({ where: { id } });
    if (!mapping) {
      throw new NotFoundException(`ClientMapping with id="${id}" not found`);
    }
    return mapping;
  }

  async update(
    id: number,
    dto: UpdateClientMappingDto,
  ): Promise<ClientMapping> {
    const mapping = await this.findOne(id);

    if (dto.togglClientId !== undefined) {
      const duplicate = await this.repo.findOne({
        where: { togglClientId: String(dto.togglClientId) },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `ClientMapping with togglClientId=${dto.togglClientId} already exists`,
        );
      }
      mapping.togglClientId = String(dto.togglClientId);
    }

    if (dto.name !== undefined) mapping.name = dto.name;
    if (dto.togglWorkspaceId !== undefined)
      mapping.togglWorkspaceId = String(dto.togglWorkspaceId);
    if (dto.fakturoidSubjectId !== undefined)
      mapping.fakturoidSubjectId = String(dto.fakturoidSubjectId);
    if (dto.hourlyRate !== undefined)
      mapping.hourlyRate = String(dto.hourlyRate);
    if (dto.currency !== undefined) mapping.currency = dto.currency;
    if (dto.isActive !== undefined) mapping.isActive = dto.isActive;

    return this.repo.save(mapping);
  }

  async remove(id: number): Promise<void> {
    const mapping = await this.findOne(id);
    await this.repo.remove(mapping);
  }
}
