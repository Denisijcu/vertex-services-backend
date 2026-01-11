import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class JobType {
  @Field(() => ID)
  _id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  status: string;

  @Field()
  price: number;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  category?: string;

  @Field(() => UserBasicType, { nullable: true })
  client?: UserBasicType;

  @Field(() => UserBasicType, { nullable: true })
  provider?: UserBasicType;

  @Field({ nullable: true })
  createdAt?: string;

  @Field({ nullable: true })
  updatedAt?: string;
}

// Crear este tipo para evitar referencias circulares
@ObjectType()
export class UserBasicType {
  @Field(() => ID)
  _id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  avatar?: string;
}
