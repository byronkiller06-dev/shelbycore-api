import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
const STATES = ['PENDING', 'RUNNING', 'BLOCKED', 'DONE', 'CANCELLED'] as const;

export class CreateTaskDto {
  @IsString() title!: string;
  @IsOptional() @IsString() intent?: string;
  @IsOptional() @IsString() agentId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsIn(PRIORITIES) priority?: string;
  @IsOptional() @IsISO8601() dueAt?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsIn(STATES) state?: string;
  @IsOptional() @IsIn(PRIORITIES) priority?: string;
  @IsOptional() @IsString() agentId?: string;
  @IsOptional() @IsISO8601() dueAt?: string;
}
