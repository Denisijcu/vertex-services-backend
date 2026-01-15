import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { JwtStrategy } from './jwt.strategy';
import { UserService } from './user.service';
import { NotificationService } from './notification.service';
import { User, UserSchema } from '../user.schema'; 
import { Notification, NotificationSchema } from '../notification.schema';
import { NotificationResolver } from 'src/notificacion.resolver';
import { PostQuantumCryptoService } from '../crypto/post-quantum-crypto.service'; 

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    
    // 🔥 SOLUCIÓN ALTERNATIVA: Más simple y directa
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET') || 'vertex-secret-key-2024-super-secure',
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN') || '60m',
          issuer: 'vertex-amazon-api',
        },
      }),
    }),
    
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema }
    ]),
  ],
  
  providers: [
    AuthService, 
    AuthResolver, 
    JwtStrategy, 
    UserService, 
    NotificationService,
    NotificationResolver,
    PostQuantumCryptoService,
  ],
  
  exports: [
    AuthService, 
    JwtStrategy,
    PassportModule,
    UserService, 
    NotificationService,
    MongooseModule,
    PostQuantumCryptoService
  ],
})
export class AuthModule {
  constructor() {
    console.log('✅ AuthModule inicializado correctamente');
  }
}