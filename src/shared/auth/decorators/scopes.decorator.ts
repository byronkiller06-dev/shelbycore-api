import { SetMetadata } from '@nestjs/common';
export const SCOPES_KEY = 'scopes';
/** ABAC: exige scopes concretos (p.ej. 'crm:write'). El rol admin tiene '*'. */
export const Scopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);
