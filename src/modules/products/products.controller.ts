import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './products.dto';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../../shared/auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly svc: ProductsService) {}

  @Get()
  list(@CurrentTenant() t: string) { return this.svc.list(t); }

  @Get(':id')
  get(@CurrentTenant() t: string, @Param('id') id: string) { return this.svc.get(t, id); }

  @Post()
  create(@CurrentTenant() t: string, @Body() dto: CreateProductDto) { return this.svc.create(t, dto); }

  @Patch(':id')
  update(@CurrentTenant() t: string, @Param('id') id: string, @Body() dto: UpdateProductDto) { return this.svc.update(t, id, dto); }

  @Delete(':id')
  remove(@CurrentTenant() t: string, @Param('id') id: string) { return this.svc.remove(t, id); }
}
