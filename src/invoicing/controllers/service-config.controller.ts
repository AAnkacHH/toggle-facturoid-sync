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
} from '@nestjs/common';
import { ServiceConfigService } from '../services/service-config.service';
import { CreateServiceConfigDto } from '../dto/create-service-config.dto';
import { UpdateServiceConfigDto } from '../dto/update-service-config.dto';

@Controller('api/service-config')
export class ServiceConfigController {
  constructor(private readonly serviceConfigService: ServiceConfigService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateServiceConfigDto) {
    return this.serviceConfigService.create(dto);
  }

  @Get()
  findAll() {
    return this.serviceConfigService.findAll();
  }

  @Get('service/:serviceName')
  findByService(@Param('serviceName') serviceName: string) {
    return this.serviceConfigService.findByService(serviceName);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceConfigService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceConfigDto) {
    return this.serviceConfigService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.serviceConfigService.remove(id);
  }
}
