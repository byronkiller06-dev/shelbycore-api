import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ChatTurnDto {
  @IsIn(['user', 'model']) role!: 'user' | 'model';
  @IsString() text!: string;
}

class ModelConfigDto {
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(2) temperature?: number;
  @IsOptional() @IsNumber() maxOutputTokens?: number;
  @IsOptional() @IsBoolean() json?: boolean;
}

export class AskDto {
  @IsString() prompt!: string;
  @IsOptional() @IsString() businessContext?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChatTurnDto) history?: ChatTurnDto[];
  @IsOptional() @ValidateNested() @Type(() => ModelConfigDto) config?: ModelConfigDto;
}

export class AnalyzeDto {
  /** Datos de negocio en texto/JSON (ventas, inventario, etc.). */
  @IsString() data!: string;
  @IsOptional() @IsString() question?: string;
  @IsOptional() @IsString() businessContext?: string;
}

export class AssistDto {
  @IsString() prompt!: string;
  @IsIn(['admin', 'worker']) audience!: 'admin' | 'worker';
  @IsOptional() @IsString() businessContext?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChatTurnDto) history?: ChatTurnDto[];
}
