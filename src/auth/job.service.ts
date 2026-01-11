import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Job, JobDocument } from '../job.schema';
import { UserService } from './user.service';
import { NotificationService } from './notification.service'; // 👈 1. IMPORTANTE: Agrega este import

@Injectable()
export class JobService {
  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    private userService: UserService,
    private notificationService: NotificationService, // 👈 2. Inyectamos el servicio aquí
  ) { }

  // 1. Crear un nuevo contrato de trabajo
  async create(data: any): Promise<JobDocument> {
    const newJob = new this.jobModel(data);
    const savedJob = await newJob.save();

    return savedJob;
  }

  // 2. Buscar todos los trabajos (Admin)
  async findAll(): Promise<JobDocument[]> {
    return await this.jobModel.find().sort({ createdAt: -1 }).exec();
  }

  // 3. Buscar trabajos por usuario
  async findByUser(userId: string): Promise<JobDocument[]> {
    return await this.jobModel.find({
      $or: [
        { 'client._id': userId },
        { 'provider._id': userId }
      ]
    }).sort({ createdAt: -1 }).exec();
  }



  // 4. Buscar un trabajo específico
  async findOne(id: string): Promise<JobDocument> {
    return await this.jobModel.findById(id).exec();
  }

  // 5. Actualizar estado (ACEPTAR O COMPLETAR TRABAJO)
  // 5. Actualizar estado (ACEPTAR O COMPLETAR TRABAJO)
  async updateStatus(id: string, status: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(id).exec();
    if (!job) throw new NotFoundException('Job not found');

    const oldStatus = job.status;
    const updateData: any = { status };

    // ✅ VALIDACIÓN: No permitir IN_PROGRESS sin pago
    if (status === 'IN_PROGRESS' && oldStatus !== 'IN_PROGRESS') {
      if (!job.payment?.stripePaymentIntentId) {
        throw new BadRequestException('Payment required before starting job');
      }
    }

    // ✅ Cuando acepta el job (OPEN → PENDING_PAYMENT)
    if (status === 'PENDING_PAYMENT' && oldStatus === 'OPEN') {
      updateData.acceptedAt = new Date();
     // console.log(`✅ Provider accepted job: ${job.title}`);
    }

    // ✅ Cuando completa el job
    if (status === 'COMPLETED' && oldStatus !== 'COMPLETED') {
      updateData.completedAt = new Date();

      if (job.provider && job.provider._id) {
      //  console.log(`💰 Job completed: ${job.title} - $${job.price}`);
        await this.userService.incrementUserEarnings(
          job.provider._id.toString(),
          job.price
        );
      }
    }

    return await this.jobModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).exec();
  }

  findMyJobs(userId: string) {
    return this.jobModel.find({
      $or: [
        { 'client._id': userId },
        { 'provider._id': userId }
      ]
    }).sort({ createdAt: -1 }); // 👈 Ordenados por el más reciente
  }

  async acceptJob(jobId: string, userId: string) {
    return this.jobModel.findByIdAndUpdate(
      jobId,
      {
        provider: userId,
        status: 'ASSIGNED',
      },
      { new: true },
    );
  }

  // En auth/job.service.ts
  async findJobsAsClient(userId: string) {
    return await this.jobModel.find({ 'client._id': userId }).sort({ createdAt: -1 }).exec();
  }

  async findJobsAsProvider(userId: string) {
    return await this.jobModel.find({ 'provider._id': userId }).sort({ createdAt: -1 }).exec();
  }

  // Obtener job por ID
  async getJobById(id: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(id).exec();
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }
}
