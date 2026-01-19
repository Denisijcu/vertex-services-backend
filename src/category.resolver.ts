
// ==========================================
// 3. CATEGORY RESOLVER (backend/src/category.resolver.ts)
// ==========================================
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { CategoryService } from './category.service';
import { Category } from './category.schema';
import { CreateCategoryInput, UpdateCategoryInput } from './category.input';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from './auth/graphql-auth.guard';
import { Roles } from './auth/roles.decorator';

@Resolver(() => Category)
export class CategoryResolver {
  constructor(private categoryService: CategoryService) {}

  @Query(() => [Category], { description: 'Obtener todas las categorías activas' })
  async getCategories(
    @Args('activeOnly', { type: () => Boolean, defaultValue: true }) activeOnly: boolean,
  ): Promise<Category[]> {
    return this.categoryService.findAll(activeOnly);
  }

  @Query(() => Category, { nullable: true, description: 'Obtener categoría por ID o slug' })
  async getCategory(
    @Args('id', { nullable: true }) id?: string,
    @Args('slug', { nullable: true }) slug?: string,
  ): Promise<Category | null> {
    if (id) return this.categoryService.findById(id);
    if (slug) return this.categoryService.findBySlug(slug);
    throw new Error('Debes proporcionar id o slug');
  }

  @Query(() => [Category], { description: 'Buscar categorías por término' })
  async searchCategories(
    @Args('term') term: string,
  ): Promise<Category[]> {
    return this.categoryService.search(term);
  }

  @Query(() => [Category], { description: 'Obtener categorías populares' })
  async getPopularCategories(
    @Args('limit', { type: () => Number, defaultValue: 6 }) limit: number,
  ): Promise<Category[]> {
    return this.categoryService.findPopular(limit);
  }

  @Mutation(() => Category)
  @UseGuards(GqlAuthGuard)
  @Roles('ADMIN')
  async createCategory(
    @Args('input') input: CreateCategoryInput,
  ): Promise<Category> {
    return this.categoryService.create(input);
  }

  @Mutation(() => Category)
  @UseGuards(GqlAuthGuard)
  @Roles('ADMIN')
  async updateCategory(
    @Args('id') id: string,
    @Args('input') input: UpdateCategoryInput,
  ): Promise<Category> {
    return this.categoryService.update(id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  @Roles('ADMIN')
  async deleteCategory(@Args('id') id: string): Promise<boolean> {
    await this.categoryService.delete(id);
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  @Roles('ADMIN')
  async reorderCategories(
    @Args('orders', { type: () => [String] }) orders: string[],
  ): Promise<boolean> {
    await this.categoryService.reorder(orders);
    return true;
  }

  @Mutation(() => Boolean)
async forceSeed() {
  await this.categoryService.seedCategories();
  return true;
}


}