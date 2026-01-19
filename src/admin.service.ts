
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { Job, JobDocument } from './job.schema';
import { GeneralStatsType } from './user-info-type';
import { Notification, NotificationDocument } from './notification.schema';
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) { }

  /**
   * 📊 OBTENER ESTADÍSTICAS GENERALES
   */
  async getGeneralStats(): Promise<GeneralStatsType> {
    try {
      const totalUsers = await this.userModel.countDocuments();
      const totalProviders = await this.userModel.countDocuments({ role: 'PROVIDER' });
      const totalClients = await this.userModel.countDocuments({ role: 'CLIENT' });
      const activeUsers = await this.userModel.countDocuments({ isActive: true });

      const completedJobs = await this.jobModel.countDocuments({ status: 'COMPLETED' });
      const cancelledJobs = await this.jobModel.countDocuments({ status: 'CANCELLED' });
      const pendingPayments = await this.jobModel.countDocuments({ status: 'PENDING_PAYMENT' });

      // Calcular ingresos totales (suma de todos los precios de trabajos completados)
      const earnings = await this.jobModel.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ]);
      const totalEarnings = earnings[0]?.total || 0;

      // Calcular escrow (trabajos en progreso)
      const escrowJobs = await this.jobModel.aggregate([
        { $match: { status: 'IN_PROGRESS' } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ]);
      const inEscrow = escrowJobs[0]?.total || 0;

      return {
        totalUsers,
        totalProviders,
        totalClients,
        activeUsers,
        totalEarnings,
        inEscrow,
        disputesCount: 0, // TODO: Implementar cuando tengas disputas schema
        pendingPayments,
        completedJobs,
        cancelledJobs,
      };
    } catch (error) {
      this.logger.error('Error getting general stats:', error);
      throw new BadRequestException('Error al obtener estadísticas');
    }
  }

  /**
   * 👥 OBTENER TODOS LOS USUARIOS
   */
  async findAllUsers(): Promise<UserDocument[]> {
    try {
      return await this.userModel
        .find()
        .select('-password')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      this.logger.error('Error finding users:', error);
      throw new BadRequestException('Error al obtener usuarios');
    }
  }

  /**
   * 🔄 TOGGLE STATUS DE USUARIO (Activar/Desactivar)
   */
  async toggleUserStatus(userId: string, isActive: boolean): Promise<UserDocument> {
    try {
      const user = await this.userModel.findByIdAndUpdate(
        userId,
        { $set: { isActive } },
        { new: true }
      );

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      this.logger.log(`User ${userId} status changed to ${isActive}`);
      return user;
    } catch (error) {
      this.logger.error('Error toggling user status:', error);
      throw new BadRequestException('Error al cambiar estado del usuario');
    }
  }

  /**
   * 🚫 SUSPENDER USUARIO
   */
  async suspendUser(userId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userModel.findByIdAndUpdate(
        userId,
        {
          $set: {
            isActive: false,
            suspensionReason: reason,
            suspendedAt: new Date()
          }
        },
        { new: true }
      );

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      this.logger.warn(`User ${userId} suspended. Reason: ${reason}`);
      return { success: true, message: `Usuario ${user.name} suspendido` };
    } catch (error) {
      this.logger.error('Error suspending user:', error);
      throw new BadRequestException('Error al suspender usuario');
    }
  }

  /**
   * ✅ RESTAURAR USUARIO SUSPENDIDO
   */
  async restoreUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userModel.findByIdAndUpdate(
        userId,
        {
          $set: {
            isActive: true,
            suspensionReason: null,
            suspendedAt: null
          }
        },
        { new: true }
      );

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      this.logger.log(`User ${userId} restored`);
      return { success: true, message: `Usuario ${user.name} restaurado` };
    } catch (error) {
      this.logger.error('Error restoring user:', error);
      throw new BadRequestException('Error al restaurar usuario');
    }
  }

  /**
   * 🔒 BANEAR USUARIO PERMANENTEMENTE
   */
  async banUser(userId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userModel.findByIdAndUpdate(
        userId,
        {
          $set: {
            isActive: false,
            isBanned: true,
            banReason: reason,
            bannedAt: new Date()
          }
        },
        { new: true }
      );

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Cancelar todos sus trabajos activos
      await this.jobModel.updateMany(
        { $or: [{ 'client._id': userId }, { 'provider._id': userId }], status: { $in: ['OPEN', 'IN_PROGRESS'] } },
        { $set: { status: 'CANCELLED', cancellationReason: `Usuario baneado: ${reason}` } }
      );

      this.logger.error(`User ${userId} BANNED. Reason: ${reason}`);
      return { success: true, message: `Usuario ${user.name} baneado permanentemente` };
    } catch (error) {
      this.logger.error('Error banning user:', error);
      throw new BadRequestException('Error al banear usuario');
    }
  }

  /**
   * 🔧 CAMBIAR ROL DE USUARIO
   */
  async changeUserRole(userId: string, newRole: string): Promise<{ success: boolean; message: string }> {
    try {
      const validRoles = ['ADMIN', 'PROVIDER', 'CLIENT', 'BOTH'];

      if (!validRoles.includes(newRole)) {
        throw new BadRequestException(`Rol inválido: ${newRole}`);
      }

      const user = await this.userModel.findByIdAndUpdate(
        userId,
        { $set: { role: newRole } },
        { new: true }
      );

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      this.logger.log(`User ${userId} role changed to ${newRole}`);
      return { success: true, message: `Rol de ${user.name} cambiado a ${newRole}` };
    } catch (error) {
      this.logger.error('Error changing user role:', error);
      throw new BadRequestException('Error al cambiar rol del usuario');
    }
  }

  /**
   * 💰 ACTUALIZAR COMISIÓN DE LA PLATAFORMA
   */
  async updatePlatformFee(percentage: number): Promise<{ success: boolean; newPercentage: number }> {
    try {
      if (percentage < 0 || percentage > 50) {
        throw new BadRequestException('La comisión debe estar entre 0 y 50%');
      }

      // Aquí guardas en la base de datos o en variables globales
      // Por ahora solo retornamos el valor
      this.logger.log(`Platform fee updated to ${percentage}%`);

      return { success: true, newPercentage: percentage };
    } catch (error) {
      this.logger.error('Error updating platform fee:', error);
      throw new BadRequestException('Error al actualizar la comisión');
    }
  }

  /**
   * 💸 FORZAR REEMBOLSO
   */
  async forceRefund(jobId: string, reason: string): Promise<{ success: boolean; refundAmount: number; message: string }> {
    try {
      const job = await this.jobModel.findById(jobId);

      if (!job) {
        throw new NotFoundException('Trabajo no encontrado');
      }

      const refundAmount = job.price;

      // Marcar job como reembolsado
      await this.jobModel.findByIdAndUpdate(
        jobId,
        {
          $set: {
            status: 'REFUNDED',
            'payment.status': 'REFUNDED',
            refundReason: reason,
            refundedAt: new Date()
          }
        }
      );

      this.logger.warn(`Force refund executed for job ${jobId}. Amount: $${refundAmount}. Reason: ${reason}`);

      return {
        success: true,
        refundAmount,
        message: `Reembolso forzado de $${refundAmount} procesado`
      };
    } catch (error) {
      this.logger.error('Error forcing refund:', error);
      throw new BadRequestException('Error al procesar reembolso forzado');
    }
  }

  /**
   * ⚖️ RESOLVER DISPUTA
   */
  async resolveDispute(
    disputeId: string,
    resolution: string,
    amount: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      // TODO: Implementar cuando tengas el schema de Disputes
      this.logger.log(`Dispute ${disputeId} resolved with resolution: ${resolution}, amount: $${amount}`);

      return {
        success: true,
        message: `Disputa resuelta con resolución: ${resolution}`
      };
    } catch (error) {
      this.logger.error('Error resolving dispute:', error);
      throw new BadRequestException('Error al resolver disputa');
    }
  }


  /**
   * 📢 CREAR ALERTA DEL SISTEMA
   */
  async createSystemAlert(
    title: string,
    message: string,
    severity: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.warn(`System Alert created. Severity: ${severity}. Title: ${title}`);

      // 🔔 CREAR NOTIFICACIÓN PARA TODOS LOS USUARIOS ACTIVOS
      const activeUsers = await this.userModel.find({ isActive: true }).select('_id').exec();

      const notifications = activeUsers.map(user => ({
        recipientId: user._id, // 👈 CAMBIO: userId → recipientId
        type: 'SYSTEM_ALERT',
        message: `${title}: ${message}`,
        severity: severity,
        isRead: false,
        createdAt: new Date()
      }));

      // Insertar todas las notificaciones de una vez
      if (notifications.length > 0) {
        await this.notificationModel.insertMany(notifications);
        this.logger.log(`✅ ${notifications.length} notificaciones de alerta creadas`);
      }

      return {
        success: true,
        message: `Alerta enviada a ${notifications.length} usuarios activos`
      };
    } catch (error) {
      this.logger.error('Error creating system alert:', error);
      throw new BadRequestException('Error al crear alerta del sistema');
    }
  }

  /**
   * 📋 OBTENER LOGS DEL SISTEMA
   */
  async getSystemLogs(limit: number = 50): Promise<any[]> {
    try {
      // TODO: Implementar cuando tengas schema de SystemLogs
      this.logger.log(`Fetching system logs. Limit: ${limit}`);
      return [];
    } catch (error) {
      this.logger.error('Error fetching system logs:', error);
      throw new BadRequestException('Error al obtener logs del sistema');
    }
  }

  /**
   * ⚖️ OBTENER DISPUTAS
   */
  async getDisputes(): Promise<any[]> {
    try {
      // TODO: Implementar cuando tengas schema de Disputes
      this.logger.log('Fetching disputes');
      return [];
    } catch (error) {
      this.logger.error('Error fetching disputes:', error);
      throw new BadRequestException('Error al obtener disputas');
    }
  }

  /**
   * 🎯 OBTENER TODOS LOS TRABAJOS
   */
  async getAllJobs(): Promise<JobDocument[]> {
    try {
      return await this.jobModel
        .find()
        .sort({ createdAt: -1 })
        .populate('client', 'name email')
        .populate('provider', 'name email')
        .exec();
    } catch (error) {
      this.logger.error('Error getting all jobs:', error);
      throw new BadRequestException('Error al obtener trabajos');
    }
  }
}