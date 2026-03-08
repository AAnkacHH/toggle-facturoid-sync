import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientMapping } from '../entities/client-mapping.entity';
import { CreateClientMappingDto } from '../dto/create-client-mapping.dto';
import { UpdateClientMappingDto } from '../dto/update-client-mapping.dto';

@Controller('api/client-mappings')
export class ClientMappingController {
  constructor(
    @InjectRepository(ClientMapping)
    private readonly repo: Repository<ClientMapping>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateClientMappingDto): Promise<ClientMapping> {
    // Check for duplicate togglClientId
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
      currency: dto.currency ?? 'CZK',
      isActive: dto.isActive ?? true,
    });

    return this.repo.save(entity);
  }

  @Get()
  async findAll(@Query('active') active?: string): Promise<ClientMapping[]> {
    if (active === 'true') {
      return this.repo.find({ where: { isActive: true } });
    }
    if (active === 'false') {
      return this.repo.find({ where: { isActive: false } });
    }
    return this.repo.find();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ClientMapping> {
    const mapping = await this.repo.findOne({ where: { id } });
    if (!mapping) {
      throw new NotFoundException(`ClientMapping with id="${id}" not found`);
    }
    return mapping;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClientMappingDto,
  ): Promise<ClientMapping> {
    const mapping = await this.repo.findOne({ where: { id } });
    if (!mapping) {
      throw new NotFoundException(`ClientMapping with id="${id}" not found`);
    }

    // If togglClientId is being updated, check for duplicate
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    const mapping = await this.repo.findOne({ where: { id } });
    if (!mapping) {
      throw new NotFoundException(`ClientMapping with id="${id}" not found`);
    }
    await this.repo.remove(mapping);
  }
}
