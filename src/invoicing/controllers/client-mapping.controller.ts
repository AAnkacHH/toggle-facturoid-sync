import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientMapping } from '../entities/client-mapping.entity';
import { CreateClientMappingDto } from '../dto/create-client-mapping.dto';
import { UpdateClientMappingDto } from '../dto/update-client-mapping.dto';
import { ClientMappingService } from '../services/client-mapping.service';

@Controller('api/invoicing/clients')
export class ClientMappingController {
  constructor(
    private readonly clientMappingService: ClientMappingService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateClientMappingDto): Promise<ClientMapping> {
    return this.clientMappingService.create(dto);
  }

  @Get()
  findAll(@Query('active') active?: string): Promise<ClientMapping[]> {
    return this.clientMappingService.findAll(active);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ClientMapping> {
    return this.clientMappingService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientMappingDto,
  ): Promise<ClientMapping> {
    return this.clientMappingService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.clientMappingService.remove(id);
  }
}
