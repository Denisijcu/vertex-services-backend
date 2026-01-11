import { Module, forwardRef } from '@nestjs/common'; // Agregamos forwardRef por seguridad
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './auth/user.service';
import { User, UserSchema } from './user.schema';
import { AuthModule } from './auth/auth.module'; 

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Usamos forwardRef si AuthModule también importa a UserModule
    forwardRef(() => AuthModule), 
  ],
  providers: [UserService],
  exports: [
    UserService, 
    MongooseModule // 👈 ¡AÑADE ESTO AQUÍ TAMBIÉN!
  ] 
})
export class UserModule {}
