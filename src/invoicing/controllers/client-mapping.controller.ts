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
import {
  ApiBasicAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ClientMapping } from '../entities/client-mapping.entity';
import { CreateClientMappingDto } from '../dto/create-client-mapping.dto';
import { UpdateClientMappingDto } from '../dto/update-client-mapping.dto';
import { ClientMappingService } from '../services/client-mapping.service';

@ApiTags('Client Mappings')
@ApiBasicAuth()
@Controller('api/invoicing/clients')
export class ClientMappingController {
  constructor(private readonly clientMappingService: ClientMappingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a client mapping',
    description:
      'Maps a Toggl client to a Fakturoid subject with an hourly rate for invoicing.',
  })
  @ApiResponse({
    status: 201,
    description: 'Client mapping created successfully',
    type: ClientMapping,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateClientMappingDto): Promise<ClientMapping> {
    return this.clientMappingService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all client mappings',
    description:
      'Returns all client mappings. Optionally filter by active status.',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    description: 'Filter by active status ("true" or "false")',
    example: 'true',
  })
  @ApiResponse({
    status: 200,
    description: 'List of client mappings',
    type: [ClientMapping],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query('active') active?: string): Promise<ClientMapping[]> {
    return this.clientMappingService.findAll(active);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single client mapping by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the client mapping',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Client mapping found',
    type: ClientMapping,
  })
  @ApiResponse({ status: 404, description: 'Client mapping not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string): Promise<ClientMapping> {
    return this.clientMappingService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a client mapping',
    description: 'Partially updates a client mapping.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the client mapping',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Client mapping updated successfully',
    type: ClientMapping,
  })
  @ApiResponse({ status: 404, description: 'Client mapping not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientMappingDto,
  ): Promise<ClientMapping> {
    return this.clientMappingService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a client mapping',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the client mapping',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 204,
    description: 'Client mapping deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Client mapping not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id') id: string): Promise<void> {
    return this.clientMappingService.remove(id);
  }
}
