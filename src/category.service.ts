import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './category.schema';
import { CreateCategoryInput, UpdateCategoryInput } from './category.input';
// 1. IMPORTANTE: Importa tus semillas (verifica que la ruta sea correcta)
import { INITIAL_CATEGORIES } from './seeds/categories.seed'; 

@Injectable()
export class CategoryService implements OnModuleInit {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  // 2. Este método se dispara solo al iniciar la App
  async onModuleInit() {
    await this.seedCategories();
  }

  // 3. La función que faltaba para llenar la DB
  async seedCategories(): Promise<void> {
    const count = await this.categoryModel.countDocuments();
    
    if (count === 0) {
      console.log('🌱 Vertex Seed: No hay categorías. Poblando base de datos...');
      
      const categoriesToCreate = INITIAL_CATEGORIES.map(cat => ({
        ...cat,
        slug: this.generateSlug(cat.name),
        isActive: true,
        providersCount: 0,
        jobsCount: 0,
      }));

      try {
        await this.categoryModel.insertMany(categoriesToCreate);
        console.log(`✅ Vertex Seed: ${categoriesToCreate.length} categorías creadas.`);
      } catch (error:any) {
        console.error('❌ Vertex Seed Error:', error.message);
      }
    } else {
      console.log('📊 Vertex Seed: Las categorías ya existen.');
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  async findAll(activeOnly = true): Promise<Category[]> {
    const query = activeOnly ? { isActive: true } : {};
    return this.categoryModel
      .find(query)
      .sort({ order: 1, name: 1 })
      .exec();
  }

  async findById(id: string): Promise<Category | null> {
    return this.categoryModel.findById(id).exec();
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return this.categoryModel.findOne({ slug }).exec();
  }

  async search(term: string): Promise<Category[]> {
    return this.categoryModel
      .find({
        $or: [
          { name: { $regex: term, $options: 'i' } },
          { keywords: { $in: [new RegExp(term, 'i')] } },
          { description: { $regex: term, $options: 'i' } },
        ],
        isActive: true,
      })
      .limit(10)
      .exec();
  }

  async findPopular(limit: number): Promise<Category[]> {
    return this.categoryModel
      .find({ isActive: true })
      .sort({ providersCount: -1, jobsCount: -1 })
      .limit(limit)
      .exec();
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const slug = this.generateSlug(input.name);
    const existing = await this.categoryModel.findOne({ slug });
    if (existing) {
      throw new BadRequestException('Ya existe una categoría con ese nombre');
    }

    const category = new this.categoryModel({
      ...input,
      slug,
      providersCount: 0,
      jobsCount: 0,
    });

    return category.save();
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Categoría no encontrada');

    const updateData: any = { ...input };
    if (input.name && input.name !== category.name) {
      const slug = this.generateSlug(input.name);
      const existing = await this.categoryModel.findOne({ slug, _id: { $ne: id } });
      if (existing) throw new BadRequestException('Ya existe ese nombre');
      updateData.slug = slug;
    }

    category.set(updateData);
    return category.save();
  }

  async delete(id: string): Promise<void> {
    const result = await this.categoryModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Categoría no encontrada');
  }

  async reorder(ids: string[]): Promise<void> {
    const updates = ids.map((id, index) => ({
      updateOne: {
        filter: { _id: id as any },
        update: { $set: { order: index } },
      },
    }));
    await this.categoryModel.bulkWrite(updates as any);
  }

  // Métodos de conteo
  async incrementProvidersCount(categoryId: string): Promise<void> {
    await this.categoryModel.findByIdAndUpdate(categoryId, { $inc: { providersCount: 1 } });
  }

  async decrementProvidersCount(categoryId: string): Promise<void> {
    await this.categoryModel.findByIdAndUpdate(categoryId, { $inc: { providersCount: -1 } });
  }

  async incrementJobsCount(categoryId: string): Promise<void> {
    await this.categoryModel.findByIdAndUpdate(categoryId, { $inc: { jobsCount: 1 } });
  }

  async decrementJobsCount(categoryId: string): Promise<void> {
    await this.categoryModel.findByIdAndUpdate(categoryId, { $inc: { jobsCount: -1 } });
  }
}