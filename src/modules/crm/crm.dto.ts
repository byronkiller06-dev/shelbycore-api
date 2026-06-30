import { IsEmail, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const STAGES = ['LEAD', 'PROSPECT', 'NEGOTIATION', 'CUSTOMER', 'LOST'] as const;

export class CreateCustomerDto {
  @IsString() name!: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() product?: string;
  @IsOptional() @IsIn(STAGES) stage?: string;
  @IsOptional() @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() product?: string;
  @IsOptional() @IsIn(STAGES) stage?: string;
  @IsOptional() @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsNumber() score?: number;
  @IsOptional() @IsString() notes?: string;
}
