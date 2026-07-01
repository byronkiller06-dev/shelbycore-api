import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PackagesService } from './packages.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PackagesService],
  exports: [ProductsService, PackagesService],
})
export class ProductsModule {}
