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
import {
  ApiBasicAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ServiceConfigService } from '../services/service-config.service';
import { CreateServiceConfigDto } from '../dto/create-service-config.dto';
import { UpdateServiceConfigDto } from '../dto/update-service-config.dto';
import { MaskedServiceConfigResponseDto } from '../dto/masked-service-config-response.dto';

@ApiTags('Service Config')
@ApiBasicAuth()
@Controller('api/invoicing/config')
export class ServiceConfigController {
  constructor(private readonly serviceConfigService: ServiceConfigService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a service configuration entry',
    description:
      'Stores a configuration key/value for an external service. Secret values are encrypted with AES-256-GCM.',
  })
  @ApiResponse({
    status: 201,
    description: 'Configuration created successfully',
    type: MaskedServiceConfigResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Duplicate configuration (serviceName + configKey already exists)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateServiceConfigDto) {
    return this.serviceConfigService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all service configurations',
    description:
      'Returns all config entries with secret values masked as "******".',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all service configurations',
    type: [MaskedServiceConfigResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.serviceConfigService.findAll();
  }

  @Get('service/:serviceName')
  @ApiOperation({
    summary: 'Get configurations by service name',
    description: 'Returns all config entries for a specific service.',
  })
  @ApiParam({
    name: 'serviceName',
    description: 'Name of the service (e.g. toggl, fakturoid)',
    example: 'toggl',
  })
  @ApiResponse({
    status: 200,
    description: 'Configurations for the specified service',
    type: [MaskedServiceConfigResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findByService(@Param('serviceName') serviceName: string) {
    return this.serviceConfigService.findByService(serviceName);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single service configuration by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the service configuration',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Service configuration found',
    type: MaskedServiceConfigResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string) {
    return this.serviceConfigService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a service configuration',
    description:
      'Partially updates a configuration entry. Re-encrypts if the value is secret.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the service configuration',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
    type: MaskedServiceConfigResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @ApiResponse({
    status: 409,
    description:
      'Duplicate configuration (serviceName + configKey already exists)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceConfigDto) {
    return this.serviceConfigService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a service configuration',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the service configuration',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 204,
    description: 'Configuration deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id') id: string) {
    return this.serviceConfigService.remove(id);
  }
}
