# GBrain Memory: Approved Design & Code Patterns

Este arquivo serve como catálogo de trechos de código homologados, garantindo consistência técnica em toda a base de código.

---

## 1. Padrão de Controller NestJS
Cada Controller deve injetar o Use Case e validar a entrada usando DTOs estritos:

```typescript
import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserUseCase } from './use-cases/create-user.use-case';

@Controller('users')
export class UsersController {
  constructor(private readonly createUserUseCase: CreateUserUseCase) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createUserDto: CreateUserDto) {
    return this.createUserUseCase.execute(createUserDto);
  }
}
```

## 2. Configuração Determinística de Testcontainers (PostgreSQL)
Para testes de integração rápidos e isolados:

```typescript
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

describe('Integration Test Suite', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    prisma = new PrismaClient({
      datasources: {
        db: { url: container.getConnectionString() }
      }
    });
    // Executar migrations programaticamente aqui se necessário
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
  });
});
```
