
// UBICACIÓN: backend/src/pulse/pulse.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PulseService } from './pulse.service';
import { PulseResolver } from './pulse.resolver';
import { PulsePost, PulsePostSchema } from './pulse.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PulsePost.name, schema: PulsePostSchema }])
  ],
  providers: [PulseService, PulseResolver],
  exports: [PulseService]
})
export class PulseModule {}