import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateBudgetDto {
  @IsInt() @Min(0) monthlyLimitClp!: number;
}

export class RecordUsageDto {
  @IsString() service!: string;
  @IsOptional() @IsString() endpoint?: string;
  @IsOptional() estimatedCostClp?: number;
  @IsOptional() @IsString() executor?: string;
  @IsOptional() @IsString() result?: string;
}
