import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus } from '../job.schema';
import { User, UserDocument } from '../user.schema';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // ============================================
  // 1. CREAR REVIEW (Cliente califica a Provider o viceversa)
  // ============================================
  async createReview(
    jobId: string,
    reviewerId: string,
    rating: number,
    comment: string,
    reviewType: 'CLIENT_TO_PROVIDER' | 'PROVIDER_TO_CLIENT'
  ) {
    // Validaciones
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating debe estar entre 1 y 5');
    }

    const job = await this.jobModel.findById(jobId);
    
    if (!job) {
      throw new BadRequestException('Trabajo no encontrado');
    }

    if (job.status !== JobStatus.COMPLETED) {
      throw new BadRequestException('Solo puedes calificar trabajos completados');
    }

    const reviewer = await this.userModel.findById(reviewerId);
    
    if (!reviewer) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Verificar que el reviewer sea parte del trabajo
    const isClient = job.client._id.toString() === reviewerId;
    const isProvider = job.provider?._id.toString() === reviewerId;

    if (!isClient && !isProvider) {
      throw new BadRequestException('No eres parte de este trabajo');
    }

    // Crear review según el tipo
    if (reviewType === 'CLIENT_TO_PROVIDER') {
      if (!isClient) {
        throw new BadRequestException('Solo el cliente puede calificar al proveedor');
      }

      if (job.providerReview) {
        throw new BadRequestException('Ya calificaste a este proveedor');
      }

      job.providerReview = {
        reviewerId: new Types.ObjectId(reviewerId),
        reviewerName: reviewer.name,
        rating,
        comment,
        createdAt: new Date()
      };

      let providerId = job.provider?._id.toString() || '';
      // Actualizar stats del provider
      await this.updateProviderStats(providerId, rating);

    } else {
      if (!isProvider) {
        throw new BadRequestException('Solo el proveedor puede calificar al cliente');
      }

      if (job.clientReview) {
        throw new BadRequestException('Ya calificaste a este cliente');
      }

      job.clientReview = {
        reviewerId: new Types.ObjectId(reviewerId),
        reviewerName: reviewer.name,
        rating,
        comment,
        createdAt: new Date()
      };

      // Actualizar stats del cliente
      await this.updateClientStats(job.client._id.toString(), rating);
    }

    await job.save();

    return {
      message: 'Calificación enviada exitosamente',
      review: reviewType === 'CLIENT_TO_PROVIDER' ? job.providerReview : job.clientReview
    };
  }

  // ============================================
  // 2. ACTUALIZAR STATS DEL PROVIDER
  // ============================================
  private async updateProviderStats(providerId: string, newRating: number) {
    const provider = await this.userModel.findById(providerId);
    
    if (!provider) return;

    const stats = provider.stats || {
      totalReviews: 0,
      averageRating: 0,
      jobsCompleted: 0,
      jobsReceived: 0,
      totalEarned: 0,
      totalSpent: 0
    };

    // Calcular nuevo promedio
    const totalRatings = (stats.averageRating * stats.totalReviews) + newRating;
    stats.totalReviews += 1;
    stats.averageRating = totalRatings / stats.totalReviews;

    provider.stats = stats;
    await provider.save();
  }

  // ============================================
  // 3. ACTUALIZAR STATS DEL CLIENTE
  // ============================================
  private async updateClientStats(clientId: string, newRating: number) {
    const client = await this.userModel.findById(clientId);
    
    if (!client) return;

    const stats = client.stats || {
      totalReviews: 0,
      averageRating: 0,
      jobsCompleted: 0,
      jobsReceived: 0,
      totalEarned: 0,
      totalSpent: 0
    };

    const totalRatings = (stats.averageRating * stats.totalReviews) + newRating;
    stats.totalReviews += 1;
    stats.averageRating = totalRatings / stats.totalReviews;

    client.stats = stats;
    await client.save();
  }

  // ============================================
  // 4. OBTENER REVIEWS DE UN USUARIO
  // ============================================
  async getUserReviews(userId: string, type: 'RECEIVED' | 'GIVEN') {
    let query: any;

    if (type === 'RECEIVED') {
      // Reviews que este usuario ha recibido
      query = {
        $or: [
          { 'provider._id': userId, providerReview: { $exists: true } },
          { 'client._id': userId, clientReview: { $exists: true } }
        ]
      };
    } else {
      // Reviews que este usuario ha dado
      query = {
        $or: [
          { 'providerReview.reviewerId': userId },
          { 'clientReview.reviewerId': userId }
        ]
      };
    }

    const jobs = await this.jobModel
      .find(query)
      .select('title providerReview clientReview provider client')
      .sort({ 'providerReview.createdAt': -1, 'clientReview.createdAt': -1 })
      .limit(50)
      .exec();

    const reviews = [];

    for (const job of jobs) {
      if (type === 'RECEIVED') {
        // Si el usuario es provider y tiene review
        if (job.provider?._id.toString() === userId && job.providerReview) {
          reviews.push({
            jobId: job._id,
            jobTitle: job.title,
            review: job.providerReview,
            reviewerType: 'CLIENT'
          });
        }
        // Si el usuario es cliente y tiene review
        if (job.client._id.toString() === userId && job.clientReview) {
          reviews.push({
            jobId: job._id,
            jobTitle: job.title,
            review: job.clientReview,
            reviewerType: 'PROVIDER'
          });
        }
      } else {
        // Reviews dados por este usuario
        if (job.providerReview?.reviewerId.toString() === userId) {
          reviews.push({
            jobId: job._id,
            jobTitle: job.title,
            review: job.providerReview,
            reviewedUser: job.provider
          });
        }
        if (job.clientReview?.reviewerId.toString() === userId) {
          reviews.push({
            jobId: job._id,
            jobTitle: job.title,
            review: job.clientReview,
            reviewedUser: job.client.name
          });
        }
      }
    }

    return reviews;
  }

  // ============================================
  // 5. OBTENER ESTADÍSTICAS DE REVIEWS
  // ============================================
  async getReviewStats(userId: string) {
    const user = await this.userModel.findById(userId).select('stats').exec();
    
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Obtener distribución de ratings
    const jobs = await this.jobModel.find({
      $or: [
        { 'provider._id': userId, providerReview: { $exists: true } },
        { 'client._id': userId, clientReview: { $exists: true } }
      ]
    }).exec();

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    jobs.forEach(job => {
      if (job.provider?._id?.toString() === userId && job.providerReview) {
        const rating = Math.floor(job.providerReview.rating);
        ratingDistribution[rating as keyof typeof ratingDistribution]++;
      }
      if (job.client._id.toString() === userId && job.clientReview) {
        const rating = Math.floor(job.clientReview.rating);
        ratingDistribution[rating as keyof typeof ratingDistribution]++;
      }
    });

    return {
      averageRating: user.stats?.averageRating || 0,
      totalReviews: user.stats?.totalReviews || 0,
      ratingDistribution,
      recentReviews: jobs.slice(0, 5).map(job => ({
        jobTitle: job.title,
        rating: job.providerReview?.rating || job.clientReview?.rating,
        comment: job.providerReview?.comment || job.clientReview?.comment,
        date: job.providerReview?.createdAt || job.clientReview?.createdAt
      }))
    };
  }

  // ============================================
  // 6. REPORTAR REVIEW INAPROPIADA
  // ============================================
  async reportReview(jobId: string, userId: string, reason: string) {
    const job = await this.jobModel.findById(jobId);
    
    if (!job) {
      throw new BadRequestException('Trabajo no encontrado');
    }

    // TODO: Implementar sistema de reportes
    // Por ahora solo log
    console.log(`Review reportada en job ${jobId} por usuario ${userId}: ${reason}`);

    return {
      message: 'Reporte recibido. Nuestro equipo lo revisará pronto.'
    };
  }
}