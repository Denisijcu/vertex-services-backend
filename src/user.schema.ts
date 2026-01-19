import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, Float, ID, registerEnumType } from '@nestjs/graphql';

// ============================================
// ENUMS (Registrados para GraphQL)
// ============================================
export enum UserRole {
  CLIENT = 'CLIENT',
  PROVIDER = 'PROVIDER',
  BOTH = 'BOTH',
  ADMIN = 'ADMIN'
}

registerEnumType(UserRole, { name: 'UserRole' });

// ============================================
// SUB-SCHEMAS (Con decoradores GraphQL)
// ============================================
@ObjectType('UserServiceOffered')
export class ServiceOffered {
  // ✅ Forzamos el nombre 'categoryId' para que GraphQL no intente adivinar
  @Field(() => ID, { name: 'categoryId' })
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  title: string;

  @Field({ nullable: true })
  @Prop()
  description: string;

  @Field(() => Float)
  @Prop({ required: true, min: 0 })
  pricePerHour: number;

  @Field(() => Boolean)
  @Prop({ default: true })
  isActive: boolean;



}



@ObjectType('UserSocialLinks')
export class SocialLinks {
  @Field({ nullable: true }) @Prop() linkedin?: string;
  @Field({ nullable: true }) @Prop() twitter?: string;
  @Field({ nullable: true }) @Prop() instagram?: string;
  @Field({ nullable: true }) @Prop() github?: string;
  @Field({ nullable: true }) @Prop() facebook?: string;
}

@ObjectType('UserStatistics')
export class Statistics {
  @Field(() => Float) @Prop({ default: 0 }) jobsCompleted: number;
  @Field(() => Float) @Prop({ default: 0 }) jobsReceived: number;
  @Field(() => Float) @Prop({ default: 0 }) totalEarned: number;
  @Field(() => Float) @Prop({ default: 0 }) totalSpent: number;
  @Field(() => Float) @Prop({ default: 5.0, min: 0, max: 5 }) averageRating: number;
  @Field(() => Float) @Prop({ default: 0 }) totalReviews: number;
}

@ObjectType('UserTwoFactorAuth')
export class TwoFactorAuth {
  @Field(() => Boolean, { defaultValue: false }) @Prop({ default: false }) enabled: boolean;
  @Field({ nullable: true }) @Prop() secret?: string;
  @Field(() => [String], { nullable: true }) @Prop({ type: [String], default: [] }) backupCodes?: string[];
}


@ObjectType('UserSecuritySettings')
export class SecuritySettings {
  @Field(() => Boolean, { defaultValue: false })
  @Prop({ default: false })
  biometricEnabled: boolean;

  @Field(() => String, { nullable: true })
  @Prop()
  biometricPublicKey?: string; // Llave pública generada por el móvil

  // 🛡️ FUNDAMENTAL PARA WEBAUTHN:
  @Prop()
  biometricCredentialId?: string; // El ID único del hardware de tu móvil

  @Prop({ default: 0 })
  biometricCounter?: number; // Previene ataques de replicación

  @Prop()
  currentBiometricChallenge?: string; // El desafío temporal que discutimos

  @Field({ nullable: true })
  @Prop()
  lastPasswordChange?: Date;

  @Field({ nullable: true })
  @Prop()
  passwordResetToken?: string;

  @Field({ nullable: true })
  @Prop()
  passwordResetExpires?: Date;
}
// ============================================
// USER SCHEMA
// ============================================
@ObjectType()
@Schema({ timestamps: true })
export class User {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true }) // No se expone en GraphQL por seguridad
  password: string;

  @Field()
  @Prop({ required: true, trim: true })
  name: string;

  @Field({ nullable: true })
  @Prop({ trim: true })
  bio?: string;

  @Field({ nullable: true })
  @Prop()
  phone?: string;

  @Field({ nullable: true })
  @Prop()
  location?: string;

  @Field(() => UserRole)
  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.CLIENT
  })
  role: UserRole;

  @Field({ nullable: true })
  @Prop()
  avatar?: string;

  @Field(() => [String], { nullable: 'items' })
  @Prop({ type: [String], default: [] })
  gallery?: string[];

  @Field(() => [ServiceOffered], { nullable: 'items' })
  @Prop({ type: [Object], default: [] }) // Guardamos el array de sub-objetos
  servicesOffered?: ServiceOffered[];

  @Field(() => SocialLinks, { nullable: true })
  @Prop({ type: SocialLinks })
  socialLinks?: SocialLinks;

  @Field(() => Statistics, { nullable: true })
  @Prop({
    type: Statistics,
    default: () => ({
      totalEarned: 0,
      jobsCompleted: 0,
      jobsReceived: 0,
      totalSpent: 0,
      averageRating: 5,
      totalReviews: 0
    })
  })
  stats?: Statistics;

  @Field(() => TwoFactorAuth, { nullable: true })
  @Prop({ type: TwoFactorAuth, default: {} })
  twoFactorAuth?: TwoFactorAuth;

  @Field()
  @Prop({ default: false })
  emailVerified: boolean;


  @Field({ nullable: true })
  @Prop()
  stripeCustomerId?: string;

  @Field(() => Boolean)
  @Prop({ default: true })
  isActive: boolean;

  @Field({ nullable: true })
  @Prop()
  lastLogin?: Date;

  @Field(() => [String], { nullable: 'items' })
  @Prop({ type: [String], default: [] })
  favoriteProviders?: string[];

  @Prop()
  emailVerificationToken?: string; // ✅ Para AuthService

  @Prop({ default: null })
  termsAcceptedAt?: Date;

  // ============================================
  // 🔐 POST-QUANTUM CRYPTOGRAPHY FIELDS
  // ============================================
  @Prop()
  passwordSalt?: string; // Salt para SHA-3 PBKDF2

  @Prop({ default: 'bcrypt' })
  cryptoAlgorithm?: string; // Algoritmo usado (bcrypt o SHA3-PBKDF2-KYBER)

  @Prop({ default: false })
  quantumSafeEnabled?: boolean; // Flag para auditoría

  @Prop()
  passwordChangedAt?: Date; // Cuándo se cambió la contraseña

  @Prop()
  lastLoginQuantumSafe?: boolean; // Auditoría de login post-quantum

  @Prop()
  stripeConnectedAccountId?: string; // 👈 AGREGAR

  @Prop({ default: false })
  stripeAccountComplete?: boolean; // 👈 AGREGAR


  @Field({ nullable: true }) // 👈 Esto es para que GraphQL lo reconozca
  @Prop() // 👈 Esto es para que MongoDB lo reconozca
  stripeAccountId?: string;

  @Field(() => SecuritySettings, { nullable: true })
  @Prop({
    type: SecuritySettings,
    default: () => ({
      biometricEnabled: false,
      lastPasswordChange: new Date()
    })
  })
  securitySettings?: SecuritySettings;


}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);

// Índices optimizados
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ 'servicesOffered.categoryId': 1 }); // 👈 Indexamos por el ID de categoría real
UserSchema.index({ location: 1 });