import { ApiProperty } from '@nestjs/swagger';

export class TogglClientResponseDto {
  @ApiProperty({ description: 'Toggl client ID', example: 12345678 })
  id!: number;

  @ApiProperty({ description: 'Client name in Toggl', example: 'Acme Corp' })
  name!: string;

  @ApiProperty({ description: 'Toggl workspace ID', example: 9876543 })
  wid!: number;

  @ApiProperty({
    description: 'Whether the client is archived',
    example: false,
  })
  archived!: boolean;
}

export class TogglProjectResponseDto {
  @ApiProperty({ description: 'Toggl project ID', example: 11223344 })
  id!: number;

  @ApiProperty({
    description: 'Project name in Toggl',
    example: 'Website Redesign',
  })
  name!: string;

  @ApiProperty({ description: 'Toggl workspace ID', example: 9876543 })
  wid!: number;

  @ApiProperty({
    description: 'Toggl client ID (legacy field)',
    example: 12345678,
    nullable: true,
  })
  cid!: number | null;

  @ApiProperty({
    description: 'Toggl client ID',
    example: 12345678,
    nullable: true,
  })
  client_id!: number | null;

  @ApiProperty({ description: 'Whether the project is active', example: true })
  active!: boolean;

  @ApiProperty({ description: 'Project color', example: '#06aaf5' })
  color!: string;
}
