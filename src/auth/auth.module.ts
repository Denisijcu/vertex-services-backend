import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { JwtStrategy } from './jwt.strategy';
import { UserService } from './user.service';
import { NotificationService } from './notification.service'; // 👈 IMPORTARLO
import { User, UserSchema } from '../user.schema'; 
import { Notification, NotificationSchema } from '../notification.schema'; // 👈 IMPORTARLO
import { NotificationResolver } from 'src/notificacion.resolver';


import { PostQuantumCryptoService } from '../crypto/post-quantum-crypto.service'; 


@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      // ⚠️ IMPORTANTE: Esta llave debe ser IGUAL a la del AppModule y JwtStrategy
      secret: 'vertex-secret-key-2024-super-secure', 
      signOptions: { expiresIn: '60m' },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema } // 👈 REGISTRARLO
    ]),
  ],
  providers: [
    AuthService, 
    AuthResolver, 
    JwtStrategy, 
    UserService, 
    NotificationService,
    NotificationResolver, // 👈 AGREGARLO
    PostQuantumCryptoService,
  ],
  exports: [
    AuthService, 
    UserService, 
    NotificationService, // 👈 EXPORTARLO (Para que JobModule lo vea)
    MongooseModule,
    PostQuantumCryptoService
  ],
})
export class AuthModule {}