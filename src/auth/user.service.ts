import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from '../user.schema';
import { PostQuantumCryptoService } from '../crypto/post-quantum-crypto.service'; // ✅ AGREGAR
import { isValidObjectId } from 'mongoose';


@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private postQuantumCrypto: PostQuantumCryptoService // ✅ INYECTAR
  ) { }

  // ============================================
  // BUSQUEDA DE USUARIOS
  // ============================================

  async findOneById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('-password').exec();
  }

  async findOneByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findProviders(filters?: {
    categoryId?: string;
    search?: string;
    limit?: number;
  }) {
    const query: any = {
      role: { $in: [UserRole.PROVIDER, UserRole.BOTH] },
      isActive: true
    };

    if (filters?.categoryId && isValidObjectId(filters.categoryId)) {
      query['servicesOffered.categoryId'] = new Types.ObjectId(filters.categoryId);
    }

    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { bio: { $regex: filters.search, $options: 'i' } },
        { 'servicesOffered.title': { $regex: filters.search, $options: 'i' } }
      ];
    }

    return this.userModel.find(query).select('-password').exec();
  }

  // ============================================
  // PERFIL PROFESIONAL
  // ============================================

  async updateProfessionalProfile(userId: string, input: any): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (input.gallery && input.gallery.length > 6) {
      throw new BadRequestException('Vertex Vault: El límite es de 3 imágenes por perfil');
    }

    const newRole = user.role === UserRole.CLIENT ? UserRole.BOTH : user.role;

    const services = input.services?.map((s: any) => ({
      ...s,
      categoryId: new Types.ObjectId(s.categoryId),
      isActive: true
    }));

    return this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          name: input.name,
          avatar: input.avatar,
          bio: input.bio,
          location: input.location,
          phone: input.phone,
          role: newRole,
          servicesOffered: services,
          gallery: input.gallery
        }
      },
      { new: true }
    ).select('-password');
  }

  // ============================================
  // ADMINISTRACIÓN
  // ============================================

  async toggleUserStatus(userId: string, isActive: boolean): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { isActive } },
      { new: true }
    ).select('-password');
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async changeUserRole(userId: string, newRole: UserRole): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { role: newRole } },
      { new: true }
    ).select('-password');
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async findAll(filters?: any): Promise<{ users: UserDocument[]; total: number }> {
    const query: any = {};
    if (filters?.role) query.role = filters.role;

    const [users, total] = await Promise.all([
      this.userModel.find(query).select('-password').sort({ createdAt: -1 }).exec(),
      this.userModel.countDocuments(query)
    ]);
    return { users, total };
  }

  async getGeneralStats() {
    const [totalUsers, totalProviders, totalClients, activeUsers, earningsAgg] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ role: UserRole.PROVIDER }),
      this.userModel.countDocuments({ role: UserRole.CLIENT }),
      this.userModel.countDocuments({ isActive: true }),
      this.userModel.aggregate([{ $group: { _id: null, total: { $sum: '$stats.totalEarned' } } }])
    ]);

    return {
      totalUsers,
      totalProviders,
      totalClients,
      activeUsers,
      totalEarnings: earningsAgg[0]?.total || 0
    };
  }

  // ============================================
  // UTILIDADES
  // ============================================

  async updateProfile(userId: string, updateData: any) {
    return this.userModel.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).select('-password');
  }

  async updateStats(userId: string, updates: any) {
    return this.userModel.findByIdAndUpdate(userId, { $inc: updates }, { new: true });
  }

  async incrementUserEarnings(userId: string, amount: number) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const currentJobsReceived = user.stats?.jobsReceived || 0;
    const decrement = currentJobsReceived > 0 ? -1 : 0;

    return await this.userModel.findByIdAndUpdate(
      userId,
      {
        $inc: {
          'stats.totalEarned': amount,
          'stats.jobsCompleted': 1,
          'stats.jobsReceived': decrement
        }
      },
      { new: true }
    ).exec();
  }

  async fixNegativeStats() {
    const result = await this.userModel.updateMany(
      { 'stats.jobsReceived': { $lt: 0 } },
      { $set: { 'stats.jobsReceived': 0 } }
    ).exec();

    return {
      message: 'Vertex Vault: Contadores reseteados con éxito',
      modifiedCount: result.modifiedCount
    };
  }

  // ============================================
  // CAMBIAR CONTRASEÑA (MEJORADO CON POST-QUANTUM)
  // ============================================
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // 🔐 VERIFICAR: Si tiene salt, usa post-quantum. Si no, usa bcrypt (compatibilidad)
    let isValid = false;
    
    if (user.passwordSalt) {
      // Usuario post-quantum
      isValid = this.postQuantumCrypto.verifyPassword(
        oldPassword,
        user.password,
        user.passwordSalt
      );
    } else {
      // Usuario legacy (bcrypt)
      const bcrypt = require('bcrypt');
      isValid = await bcrypt.compare(oldPassword, user.password);
    }

    if (!isValid) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    // 🔐 USAR POST-QUANTUM PARA NUEVA CONTRASEÑA
    const { hash: newHash, salt: newSalt } = this.postQuantumCrypto.hashPassword(newPassword);

    return this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          password: newHash,
          passwordSalt: newSalt, // ✅ Guardar salt post-quantum
          cryptoAlgorithm: 'SHA3-PBKDF2-KYBER', // ✅ Marcar algoritmo
          quantumSafeEnabled: true, // ✅ Marcar como post-quantum
          'securitySettings.lastPasswordChange': new Date()
        }
      },
      { new: true }
    ).select('-password');
  }

  async enableBiometric(userId: string, publicKey: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          'securitySettings.biometricEnabled': true,
          'securitySettings.biometricPublicKey': publicKey
        }
      },
      { new: true }
    ).select('-password');
  }

  async disableBiometric(userId: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          'securitySettings.biometricEnabled': false,
          'securitySettings.biometricPublicKey': null
        }
      },
      { new: true }
    ).select('-password');
  }
}