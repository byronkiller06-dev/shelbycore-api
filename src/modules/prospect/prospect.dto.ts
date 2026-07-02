import { IsIn, IsOptional, IsString } from 'class-validator';

export class SearchProspectDto {
  @IsString() service!: string;
  @IsString() city!: string;
  @IsOptional() @IsString() keyword?: string;
}

export class SaveProspectDto {
  @IsString() company!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() product?: string;
  @IsOptional() problems?: string[];
  @IsOptional() probability?: number;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() placeId?: string;
  @IsOptional() rating?: number;
  @IsOptional() verified?: boolean;
}

export class DraftDto {
  @IsIn(['proposal', 'email', 'whatsapp']) kind!: 'proposal' | 'email' | 'whatsapp';
  @IsString() company!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() problems?: string[];
  @IsOptional() recommended?: string[];
}
