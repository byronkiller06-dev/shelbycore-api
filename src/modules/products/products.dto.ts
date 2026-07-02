import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString() name!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() idealClient?: string;
  @IsOptional() @IsString() targetRubros?: string;
  @IsOptional() @IsString() problems?: string;
  @IsOptional() @IsString() benefits?: string;
  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() objections?: string;
  @IsOptional() @IsString() shortMessage?: string;
  @IsOptional() @IsString() longMessage?: string;
  @IsOptional() @IsString() salesPriority?: string;
  @IsOptional() @IsString() commercialMargin?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() idealClient?: string;
  @IsOptional() @IsString() targetRubros?: string;
  @IsOptional() @IsString() problems?: string;
  @IsOptional() @IsString() benefits?: string;
  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() objections?: string;
  @IsOptional() @IsString() shortMessage?: string;
  @IsOptional() @IsString() longMessage?: string;
  @IsOptional() @IsString() salesPriority?: string;
  @IsOptional() @IsString() commercialMargin?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
