// backend/src/pulse/pulse.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PulsePost } from './pulse.schema';

@Injectable()
export class PulseService {
  constructor(
    @InjectModel(PulsePost.name) private pulseModel: Model<PulsePost>
  ) {}

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

  async findAll(categoryId?: string, limit: number = 10, skip: number = 0) {
  const query = categoryId ? { category: categoryId } : {};

  const posts = await this.pulseModel
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .exec();

  // 🔧 Convertir a objetos con pulseId
  return posts.map(p => ({
    ...p.toObject(),
    pulseId: p._id.toString()
  }));
}

  async countPosts(categoryId?: string): Promise<number> {
    const query = categoryId ? { category: categoryId } : {};
    return await this.pulseModel.countDocuments(query).exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pulseModel.findByIdAndDelete(id);
    return !!result;
  }

  async toggleLike(pulseId: string, userId: string) {
    const post = await this.pulseModel.findById(pulseId);
    if (!post) throw new NotFoundException('Post no encontrado');

    const index = post.likes.indexOf(userId);
    
    if (index === -1) {
      post.likes.push(userId);
    } else {
      post.likes.splice(index, 1);
    }

    return await post.save();
  }

  async addComment(pulseId: string, commentData: any) {
    const post = await this.pulseModel.findByIdAndUpdate(
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

    if (!post) throw new NotFoundException('Post no encontrado');
    return post;
  }

  async findById(pulseId: string) {
    return await this.pulseModel.findById(pulseId).exec();
  }
}