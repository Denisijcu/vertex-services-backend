// backend/src/pulse/pulse.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PulseService } from './pulse.service';
import { PulseResolver } from './pulse.resolver';
import { PulsePost, PulsePostSchema } from './pulse.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PulseGateway } from './pulse.gateway';


@Module({
  imports: [
    MongooseModule.forFeature([{ name: PulsePost.name, schema: PulsePostSchema }]),
    CloudinaryModule
  ],
  providers: [PulseService, PulseResolver, PulseGateway],
  exports: [PulseService]
})
export class PulseModule {}