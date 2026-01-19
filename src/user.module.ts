
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './auth/user.service';
import { User, UserSchema } from './user.schema';
import { AuthModule } from './auth/auth.module'; 

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    AuthModule 
  ],
  providers: [UserService],
  exports: [UserService] // 👈 ¡ESTO ES LO MÁS IMPORTANTE! Permite que otros lo usen
})
export class UserModule {}