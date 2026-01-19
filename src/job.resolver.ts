import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from './auth/graphql-auth.guard';
import { JobService } from './auth/job.service';
import { NotificationService } from './auth/notification.service';
import { UserService } from './auth/user.service';
import { ChatService } from './chat.service';
import { CreateJobInput } from './create-job.input';
import { CurrentUser } from './app.resolver';
import { Job } from './job.schema';

@Resolver(() => Job)
export class JobResolver {
    constructor(
        private readonly jobService: JobService,
        private readonly userService: UserService,
        private readonly notificationService: NotificationService,
        private readonly chatService: ChatService,
    ) { }

    // Mutation para que un cliente contacte a un proveedor
    @Mutation(() => Job)
    @UseGuards(GqlAuthGuard)
    async createServiceRequest(
        @Args('input') input: CreateJobInput,
        @CurrentUser() client: any,
    ) {
        // 1. Buscamos al proveedor para obtener sus datos reales
        const provider = await this.userService.findOneById(input.providerId);

        if (!provider) {
            throw new Error('El proveedor seleccionado no está disponible en Vertex.');
        }

        // 2. Preparamos el objeto Job (Desnormalizado para rapidez)
        const jobData = {
            title: input.title,
            description: input.description,
            price: input.price,
            location: input.location,
            category: input.category,
            status: 'OPEN',
            client: {
                _id: client._id,
                name: client.name,
                email: client.email,
                avatar: client.avatar
            },
            provider: {
                _id: provider._id,
                name: provider.name,
                email: provider.email,
                avatar: provider.avatar
            }
        };

        // 3. GUARDAMOS EL TRABAJO EN MONGO (Solo una vez)
        const savedJob = await this.jobService.create(jobData);

        // 💬 CREAR CHATROOM AUTOMÁTICAMENTE
        try {
            await this.chatService.getOrCreateChatRoom(savedJob._id.toString());
            console.log(`💬 ChatRoom creado para Job: ${savedJob._id}`);
        } catch (error) {
            console.error('❌ Error creando ChatRoom:', error);
        }

        // 4. MANDAR NOTIFICACIÓN AL PROVEEDOR (Para que Juan reciba la campana 🔔)
        try {
            await this.notificationService.create({
                recipientId: provider._id.toString(), // 👈 Convertir a string
                message: `¡Nueva propuesta! ${client.name} quiere contratarte para: ${savedJob.title}`,
                type: 'JOB_NEW', // 👈 Agregado
                jobId: savedJob._id,
                isRead: false
            });
            console.log(`📣 Notificación enviada a ${provider.name} (${provider._id})`); // 👈 Log para debug


        } catch (error) {
            console.error('❌ Error enviando notificación:', error);
        }

        // 5. Retornamos el objeto ya persistido
        return savedJob;
    }

    @Query(() => [Job], { name: 'getAllJobs' })
    @UseGuards(GqlAuthGuard)
    async findAll() {
        return this.jobService.findAll();
    }

    // Mutation para actualizar el estado del trabajo (Aceptar o Terminar)
    @Mutation(() => Job)
    @UseGuards(GqlAuthGuard)
    async updateJobStatus(
        @Args('jobId', { type: () => ID }) jobId: string,
        @Args('status') status: string,
    ) {
        // 1. Llamamos al servicio que ya tiene la lógica de fechas (acceptedAt/completedAt)
        const updatedJob = await this.jobService.updateStatus(jobId, status);

        // 2. Notificar al cliente cuando el proveedor acepta/completa
        try {
            await this.notificationService.create({
                recipientId: updatedJob.client._id.toString(), // 👈 Convertir a string también
                message: `El estado de tu contrato "${updatedJob.title}" ha cambiado a: ${status}`,
                type: status === 'COMPLETED' ? 'JOB_COMPLETED' : 'JOB_ACCEPTED', // 👈 Agregado
                jobId: updatedJob._id,
                isRead: false
            });
            console.log(`📣 Notificación de cambio de estado enviada a ${updatedJob.client.name}`);
        } catch (error) {
            console.error('❌ Error al notificar cambio de estado:', error);
        }

        return updatedJob;
    }

    @Query(() => [Job])
    @UseGuards(GqlAuthGuard)
    async myJobs(@CurrentUser() user: any) {
        try {
            console.log('📋 Fetching jobs for user:', user._id);
            return await this.jobService.findMyJobs(user._id);
        } catch (error: any) {
            console.error('❌ MyJobs error:', error?.message);
            return [];
        }
    }
    @Query(() => [Job])
    @UseGuards(GqlAuthGuard)
    async getMyClientJobs(@CurrentUser() user: any) {
        try {
            return await this.jobService.findJobsAsClient(user._id);
        } catch (error: any) {
            console.error('❌ Client jobs error:', error?.message);
            return [];
        }
    }

    @Query(() => [Job])
    @UseGuards(GqlAuthGuard)
    async getMyProviderJobs(@CurrentUser() user: any) {
        try {
            return await this.jobService.findJobsAsProvider(user._id);
        } catch (error: any) {
            console.error('❌ Provider jobs error:', error?.message);
            return [];
        }
    }
}