// UBICACIÓN: backend/src/pulse/pulse.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PulsePost } from './pulse.schema';

@Injectable()
export class PulseService {
  constructor(@InjectModel(PulsePost.name) private pulseModel: Model<PulsePost>) { }

  async create(
    authorId: string, 
    content: string, 
    imageUrl?: string, 
    category?: string, 
    authorName?: string, 
    avatar?: string, 
    mediaUrl?: string, 
    mediaType?: string
  ) {
    // 🛡️ Inicializamos con likes y comments vacíos para evitar nulos en el frontend
    const newPost = new this.pulseModel({ 
      authorId, 
      content, 
      imageUrl, 
      category: category || 'GENERAL', 
      authorName, 
      avatar, 
      mediaUrl, 
      mediaType,
      likes: [],
      comments: []
    });
    return await newPost.save();
  }

  async findAll(categoryId?: string) {
    const query = categoryId ? { category: categoryId } : {};
    // Ordenamos por fecha descendente para que lo más nuevo salga arriba
    return await this.pulseModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pulseModel.findByIdAndDelete(id);
    return !!result;
  }

  // --- LÓGICA SOCIAL ---

  async toggleLike(pulseId: string, userId: string) {
    const post = await this.pulseModel.findById(pulseId);
    if (!post) throw new Error('Post no encontrado en Vertex Pulse');

    // 🚀 Lógica de Toggle: Si existe lo quita, si no, lo añade
    const index = post.likes.indexOf(userId);
    if (index === -1) {
      post.likes.push(userId); 
    } else {
      post.likes.splice(index, 1);
    }

    return await post.save();
  }

  async addComment(pulseId: string, commentData: any) {
    // 💬 Usamos $push para añadir el comentario al array sin sobrescribir nada
    // { new: true } asegura que devolvemos el post actualizado con el comentario nuevo
    return await this.pulseModel.findByIdAndUpdate(
      pulseId,
      { 
        $push: { 
          comments: { 
            ...commentData, 
            createdAt: new Date() 
          } 
        } 
      },
      { new: true }
    ).exec();
  }
}