import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateCategoryInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  icon: string;

  @Field({ nullable: true })
  color?: string;

  @Field(() => [String], { nullable: true })
  skills?: string[];

  @Field(() => [String], { nullable: true })
  keywords?: string[];

  @Field({ nullable: true })
  parentCategory?: string;

  @Field({ nullable: true })
  order?: number;
}

@InputType()
export class UpdateCategoryInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  icon?: string;

  @Field({ nullable: true })
  color?: string;

  @Field(() => [String], { nullable: true })
  skills?: string[];

  @Field(() => [String], { nullable: true })
  keywords?: string[];

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  order?: number;
}