import { IsOptional, IsString } from 'class-validator';

export class CreateDocumentDto {
  @IsString() title!: string;
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() customerId?: string;
}

export class UpdateDocumentDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsString() content?: string;
}
