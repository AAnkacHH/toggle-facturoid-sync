import { ApiProperty } from '@nestjs/swagger';

export class FakturoidSubjectResponseDto {
  @ApiProperty({ description: 'Fakturoid subject ID', example: 123 })
  id!: number;

  @ApiProperty({ description: 'Subject name', example: 'Acme Corp s.r.o.' })
  name!: string;

  @ApiProperty({
    description: 'Subject email',
    example: 'billing@acme.cz',
    nullable: true,
  })
  email!: string | null;

  @ApiProperty({
    description: 'Street address',
    example: 'Vinohradska 42',
    nullable: true,
  })
  street!: string | null;

  @ApiProperty({ description: 'City', example: 'Praha', nullable: true })
  city!: string | null;

  @ApiProperty({ description: 'Country', example: 'CZ', nullable: true })
  country!: string | null;

  @ApiProperty({
    description: 'Registration number (ICO)',
    example: '12345678',
    nullable: true,
  })
  registration_no!: string | null;
}
