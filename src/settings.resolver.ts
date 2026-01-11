import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings } from './settings.schema';

@Resolver(() => Settings)
export class SettingsResolver {
  constructor(
    @InjectModel(Settings.name)
    private settingsModel: Model<Settings>,
  ) {}

  @Query(() => Settings, { nullable: true })
  async getAISettings() {
    return this.settingsModel.findOne({});
  }

  @Mutation(() => Settings)
  async updateAISettings(
    @Args('provider') provider: string,
    @Args('model') model: string,
    @Args('url') url: string,
    @Args('key', { nullable: true }) key?: string,
  ) {
    return this.settingsModel.findOneAndUpdate(
      {},
      { aiProvider: provider, modelName: model, baseUrl: url, apiKey: key },
      { upsert: true, new: true },
    );
  }

  @Mutation(() => Boolean)
  async deleteAISettings() {
    const result = await this.settingsModel.deleteOne({});
    return result.deletedCount > 0;
  }

  // settings.resolver.ts
@Mutation(() => Settings)
async resetToDefaultSettings() {
  const defaults = {
    aiProvider: 'LOCAL',
    modelName: 'qwen2.5-7b-instruct-1m',
    baseUrl: 'http://localhost:1234/v1',
    apiKey: ''
  };
  return this.settingsModel.findOneAndUpdate({}, defaults, { upsert: true, new: true });
}
}