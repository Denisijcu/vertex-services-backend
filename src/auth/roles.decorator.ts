
import { SetMetadata } from '@nestjs/common';

// Esta constante es la "llave" que usará el Guard para buscar los roles
export const ROLES_KEY = 'roles';

// El decorador @Roles('ADMIN') simplemente guarda ese String en los metadatos
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);