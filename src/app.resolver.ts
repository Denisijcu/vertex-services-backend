import { 
  Resolver, 
  Query, 
  Mutation, 
  Args, 
  Float, 
  ObjectType, 
  Field, 
  ID, 
  InputType
} from '@nestjs/graphql';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job, JobDocument, JobStatus } from './job.schema';
import { User, UserDocument } from './user.schema';
import { 
  NotFoundException, 
  ForbiddenException, 
  UnauthorizedException,
  BadRequestException,
  UseGuards,
  createParamDecorator, 
  ExecutionContext 
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GqlAuthGuard } from './auth/graphql-auth.guard';




// ============================================
// DECORADOR PERSONALIZADO PARA USUARIO ACTUAL (LIMPIO)
// ============================================
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) => { // 👈 'data' es necesario aunque no se use
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user; // Retorna solo el usuario inyectado por el GqlAuthGuard
  },
);

// ============================================
// TIPOS GRAPHQL - OBJECTS
// ============================================

@ObjectType()
class UserType {
  @Field(() => ID)
  _id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  location?: string;
}

@ObjectType()
class ServiceOfferedType {
  @Field()
  category: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Float)
  pricePerHour: number;

  @Field()
  isActive: boolean;
}

@ObjectType()
class SocialLinksType {
  @Field({ nullable: true })
  linkedin?: string;

  @Field({ nullable: true })
  twitter?: string;

  @Field({ nullable: true })
  instagram?: string;

  @Field({ nullable: true })
  github?: string;

  @Field({ nullable: true })
  facebook?: string;
}

@ObjectType()
class StatsType {
  @Field(() => Float)
  jobsCompleted: number;

  @Field(() => Float)
  jobsReceived: number;

  @Field(() => Float)
  totalEarned: number;

  @Field(() => Float)
  totalSpent: number;

  @Field(() => Float)
  averageRating: number;

  @Field(() => Float)
  totalReviews: number;
}

@ObjectType()
class UserProfileType {
  @Field(() => ID)
  _id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  location?: string;

  @Field()
  role: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field(() => [String], { nullable: true })
  gallery?: string[];

  @Field(() => [ServiceOfferedType], { nullable: true })
  servicesOffered?: ServiceOfferedType[];

  @Field(() => SocialLinksType, { nullable: true })
  socialLinks?: SocialLinksType;

  @Field(() => StatsType, { nullable: true })
  stats?: StatsType;

  @Field()
  emailVerified: boolean;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  lastLogin?: string;
}

@ObjectType()
class JobType {
  @Field(() => ID)
  _id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Float)
  price: number;

  @Field()
  location: string;

  @Field()
  category: string;

  @Field()
  status: string;

  @Field(() => UserType, { nullable: true })
  client?: UserType;

  @Field(() => UserType, { nullable: true })
  provider?: UserType;

  @Field()
  createdAt: string;

  @Field({ nullable: true })
  acceptedAt?: string;

  @Field({ nullable: true })
  completedAt?: string;
}

// ============================================
// TIPOS GRAPHQL - INPUTS
// ============================================

@InputType()
class CreateJobInput {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Float)
  price: number;

  @Field()
  location: string;

  @Field()
  category: string;
}

@InputType()
class UpdateProfileInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  avatar?: string;
}

@InputType()
class ServiceInput {
  @Field()
  category: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Float)
  pricePerHour: number;
}

@InputType()
class SocialLinksInput {
  @Field({ nullable: true })
  linkedin?: string;

  @Field({ nullable: true })
  twitter?: string;

  @Field({ nullable: true })
  instagram?: string;

  @Field({ nullable: true })
  github?: string;

  @Field({ nullable: true })
  facebook?: string;
}


// ============================================
// RESOLVER PRINCIPAL
// ============================================

@Resolver(() => JobType)
export class AppResolver {
  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>
  ) {}

  // ============================================
  // QUERIES - TRABAJOS
  // ============================================

  @Query(() => [JobType], { nullable: 'items', description: 'Obtener todos los trabajos' })
  async jobs(
    @Args('status', { nullable: true }) status?: string,
    @Args('category', { nullable: true }) category?: string
  ) {
    const filter: any = {};
    
    if (status) filter.status = status;
    if (category) filter.category = category;

    return this.jobModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  @Query(() => JobType, { nullable: true, description: 'Obtener un trabajo por ID' })
  async job(@Args('id', { type: () => String }) id: string) {
    const job = await this.jobModel.findById(id).exec();
    
    if (!job) {
      throw new NotFoundException('Trabajo no encontrado');
    }

    return job;
  }

  // ============================================
  // QUERIES - USUARIOS
  // ============================================

  @Query(() => [UserProfileType], { nullable: 'items', description: 'Buscar proveedores de servicios' })
  async providers(
    @Args('category', { nullable: true }) category?: string,
    @Args('search', { nullable: true }) search?: string,
    @Args('minRating', { nullable: true }) minRating?: number,
    @Args('location', { nullable: true }) location?: string
  ) {
    const query: any = { 
      role: { $in: ['PROVIDER', 'BOTH'] },
      isActive: true 
    };
    
    if (category) {
      query['servicesOffered.category'] = category;
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { 'servicesOffered.title': { $regex: search, $options: 'i' } }
      ];
    }

    if (minRating) {
      query['stats.averageRating'] = { $gte: minRating };
    }

    return await this.userModel
      .find(query)
      .limit(20)
      .select('-password')
      .sort({ 'stats.averageRating': -1, 'stats.jobsCompleted': -1 })
      .exec();
  }

  @Query(() => UserProfileType, { nullable: true, description: 'Ver perfil de un usuario' })
  async userProfile(@Args('id', { type: () => String }) id: string) {
    const user = await this.userModel.findById(id).select('-password').exec();
    
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  // ============================================
  // MUTATIONS - TRABAJOS
  // ============================================

  @Mutation(() => JobType, { description: 'Crear un nuevo trabajo' })
  @UseGuards(GqlAuthGuard)
  async createJob(
    @Args('input') input: CreateJobInput,
    @CurrentUser() user: any
  ) {
    if (!user) {
      throw new UnauthorizedException('No estás logueado');
    }

    // Validaciones
    if (input.price <= 0) {
      throw new BadRequestException('El precio debe ser mayor a 0');
    }

    if (input.title.trim().length < 3) {
      throw new BadRequestException('El título debe tener al menos 3 caracteres');
    }

    console.log('👤 Usuario creando trabajo:', user.name);

    const realUser = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar
    };

    const newJob = new this.jobModel({
      ...input,
      title: input.title.trim(),
      description: input.description.trim(),
      client: realUser,
      status: JobStatus.OPEN,
    });

    const savedJob = await newJob.save();

    // Actualizar stats del cliente
    await this.userModel.findByIdAndUpdate(user._id, {
      $inc: { 'stats.jobsReceived': 1 }
    });

    return savedJob;
  }

  @Mutation(() => JobType, { description: 'Aceptar un trabajo disponible' })
  @UseGuards(GqlAuthGuard)
  async acceptJob(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() user: any
  ) {
    const job = await this.jobModel.findById(id);

    if (!job) {
      throw new NotFoundException('El trabajo no existe');
    }

    if (job.status !== JobStatus.OPEN) {
      throw new ForbiddenException('Este trabajo ya no está disponible');
    }

    // Verificar que no sea el mismo cliente
    if (job.client._id.toString() === user._id.toString()) {
      throw new ForbiddenException('No puedes aceptar tu propio trabajo');
    }

    console.log('👷‍♂️ Trabajo aceptado por:', user.name);

    const realProvider = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar
    };

    job.provider = realProvider as any;
    job.status = JobStatus.IN_PROGRESS;
    job.acceptedAt = new Date();

    return await job.save();
  }

  @Mutation(() => JobType, { description: 'Completar un trabajo' })
  @UseGuards(GqlAuthGuard)
  async completeJob(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() user: any
  ) {
    const job = await this.jobModel.findById(id);

    if (!job) {
      throw new NotFoundException('El trabajo no existe');
    }

    if (job.status !== JobStatus.IN_PROGRESS) {
      throw new ForbiddenException('Solo puedes completar trabajos en progreso');
    }

    // Verificar que sea el proveedor
    if (job.provider?._id.toString() !== user._id.toString()) {
      throw new ForbiddenException('Solo el proveedor puede completar el trabajo');
    }

    job.status = JobStatus.PENDING_PAYMENT;
    job.completedAt = new Date();

    const savedJob = await job.save();

    // Actualizar stats del proveedor
    const earnings = job.price * 0.90; // 90% después del 10% fee
    await this.userModel.findByIdAndUpdate(user._id, {
      $inc: { 
        'stats.jobsCompleted': 1,
        'stats.totalEarned': earnings
      }
    });

    return savedJob;
  }

  @Mutation(() => JobType, { description: 'Cancelar un trabajo' })
  @UseGuards(GqlAuthGuard)
  async cancelJob(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() user: any
  ) {
    const job = await this.jobModel.findById(id);

    if (!job) {
      throw new NotFoundException('El trabajo no existe');
    }

    // Solo el cliente puede cancelar
    if (job.client._id.toString() !== user._id.toString()) {
      throw new ForbiddenException('Solo el cliente puede cancelar el trabajo');
    }

    if (job.status === JobStatus.COMPLETED) {
      throw new ForbiddenException('No se puede cancelar un trabajo completado');
    }

    job.status = JobStatus.CANCELLED;

    return await job.save();
  }

  // ============================================
  // MUTATIONS - PERFIL DE USUARIO
  // ============================================

  @Mutation(() => UserProfileType, { description: 'Actualizar perfil de usuario' })
  @UseGuards(GqlAuthGuard)
  async updateProfile(
    @CurrentUser() user: any,
    @Args('input') input: UpdateProfileInput
  ) {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      user._id,
      { $set: input },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    console.log('✅ Perfil actualizado:', updatedUser.name);

    return updatedUser;
  }

  @Mutation(() => UserProfileType, { description: 'Agregar servicio ofrecido' })
  @UseGuards(GqlAuthGuard)
  async addService(
    @CurrentUser() user: any,
    @Args('input') input: ServiceInput
  ) {
    // Validaciones
    if (input.pricePerHour <= 0) {
      throw new BadRequestException('El precio debe ser mayor a 0');
    }

    if (input.title.trim().length < 3) {
      throw new BadRequestException('El título debe tener al menos 3 caracteres');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      user._id,
      { 
        $push: { 
          servicesOffered: {
            category: input.category,
            title: input.title.trim(),
            description: input.description.trim(),
            pricePerHour: input.pricePerHour,
            isActive: true
          }
        }
      },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    console.log('✅ Servicio agregado:', input.title);

    return updatedUser;
  }

  @Mutation(() => UserProfileType, { description: 'Eliminar servicio ofrecido' })
  @UseGuards(GqlAuthGuard)
  async removeService(
    @CurrentUser() user: any,
    @Args('serviceTitle') serviceTitle: string
  ) {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      user._id,
      { 
        $pull: { 
          servicesOffered: { title: serviceTitle }
        }
      },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return updatedUser;
  }

  @Mutation(() => UserProfileType, { description: 'Actualizar redes sociales' })
  @UseGuards(GqlAuthGuard)
  async updateSocialLinks(
    @CurrentUser() user: any,
    @Args('input') input: SocialLinksInput
  ) {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      user._id,
      { $set: { socialLinks: input } },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return updatedUser;
  }

  @Mutation(() => UserProfileType, { description: 'Agregar imagen a galería' })
  @UseGuards(GqlAuthGuard)
  async addToGallery(
    @CurrentUser() user: any,
    @Args('imageUrl') imageUrl: string
  ) {
    const currentUser = await this.userModel.findById(user._id);

    if (!currentUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!currentUser.gallery) {
      currentUser.gallery = [];
    }

    if (currentUser.gallery.length >= 3) {
      throw new BadRequestException('Máximo 3 imágenes en la galería');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      user._id,
      { $push: { gallery: imageUrl } },
      { new: true }
    ).select('-password');

    return updatedUser;
  }

  @Mutation(() => UserProfileType, { description: 'Eliminar imagen de galería' })
  @UseGuards(GqlAuthGuard)
  async removeFromGallery(
    @CurrentUser() user: any,
    @Args('imageUrl') imageUrl: string
  ) {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      user._id,
      { $pull: { gallery: imageUrl } },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return updatedUser;
  }

  // ============================================
  // QUERIES - MIS TRABAJOS
  // ============================================

  @Query(() => [JobType], { nullable: 'items', description: 'Obtener mis trabajos como cliente' })
  @UseGuards(GqlAuthGuard)
  async myJobsAsClient(@CurrentUser() user: any) {
    return this.jobModel
      .find({ 'client._id': user._id })
      .sort({ createdAt: -1 })
      .exec();
  }

  @Query(() => [JobType], { nullable: 'items', description: 'Obtener mis trabajos como proveedor' })
  @UseGuards(GqlAuthGuard)
  async myJobsAsProvider(@CurrentUser() user: any) {
    return this.jobModel
      .find({ 'provider._id': user._id })
      .sort({ createdAt: -1 })
      .exec();
  }

  @Query(() => [JobType], { nullable: 'items', description: 'Obtener todos mis trabajos' })
  @UseGuards(GqlAuthGuard)
  async myJobs(@CurrentUser() user: any) {
    return this.jobModel
      .find({
        $or: [
          { 'client._id': user._id },
          { 'provider._id': user._id }
        ]
      })
      .sort({ createdAt: -1 })
      .exec();
  }
}