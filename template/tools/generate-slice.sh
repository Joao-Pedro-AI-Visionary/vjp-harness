#!/usr/bin/env bash
# =============================================================================
# generate-slice.sh — Scaffold de um Vertical Slice + DDD
# =============================================================================
# Uso: ./generate-slice.sh <feature-name> [--dry-run]
#
# Cria a estrutura completa de um slice vertical em src/modules/<feature-name>/
# seguindo o padrão Vertical Slice + DDD definido em template/tools/vertical-slice-ddd.md.
#
# Exemplo:
#   ./generate-slice.sh billing
#   ./generate-slice.sh user-management --dry-run
# =============================================================================

set -euo pipefail

FEATURE_NAME="${1:-}"
DRY_RUN="${2:-}"

if [[ -z "$FEATURE_NAME" ]]; then
  echo "❌ Uso: $0 <feature-name> [--dry-run]"
  echo "   Exemplo: $0 billing"
  exit 1
fi

if [[ "$FEATURE_NAME" == "--dry-run" ]]; then
  echo "❌ Forneça um nome de feature válido antes de --dry-run"
  exit 1
fi

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "🔍 Dry-run mode — nenhum arquivo será criado"
fi

# Normalizar: kebab-case → PascalCase para nomes de classe
pascal_case() {
  local str="$1"
  # Replace hyphens/underscores with spaces, capitalize each word, remove spaces
  echo "$str" | sed -E 's/[-_]/ /g' | awk '{
    result = ""
    for (i = 1; i <= NF; i++) {
      word = $i
      first = toupper(substr(word, 1, 1))
      rest = substr(word, 2)
      result = result first rest
    }
    print result
  }'
}
PASCAL_NAME=$(pascal_case "$FEATURE_NAME")
KEBAB_NAME=$(echo "$FEATURE_NAME" | sed 's/_/-/g')
SNAKE_NAME=$(echo "$KEBAB_NAME" | sed 's/-/_/g')

BASE="src/modules/$KEBAB_NAME"

DIRS=(
  "$BASE/application/use-cases"
  "$BASE/application/dto"
  "$BASE/application/interfaces"
  "$BASE/domain/entities"
  "$BASE/domain/value-objects"
  "$BASE/domain/aggregates"
  "$BASE/domain/domain-events"
  "$BASE/domain/domain-services"
  "$BASE/domain/specifications"
  "$BASE/domain/repositories"
  "$BASE/domain/types"
  "$BASE/infrastructure/controllers"
  "$BASE/infrastructure/repositories"
  "$BASE/infrastructure/mappers"
  "$BASE/infrastructure/subscribers"
  "$BASE/tests"
)

# Função para criar arquivo com conteúdo
create_file() {
  local file="$1"
  local content="$2"

  if [[ "$DRY_RUN" == "--dry-run" ]]; then
    echo "  [dry-run] Criaria: $file"
    return
  fi

  if [[ -f "$file" ]]; then
    echo "  ⚠️  Já existe: $file (pulado)"
    return
  fi

  mkdir -p "$(dirname "$file")"
  echo "$content" > "$file"
  echo "  ✅ Criado: $file"
}

echo ""
echo "🚀 Gerando Vertical Slice: $KEBAB_NAME"
echo "   PascalCase:  $PASCAL_NAME"
echo "   Base path:   $BASE"
echo ""

# Criar diretórios
for dir in "${DIRS[@]}"; do
  if [[ "$DRY_RUN" == "--dry-run" ]]; then
    echo "  [dry-run] Criaria diretório: $dir/"
  else
    mkdir -p "$dir"
  fi
done

# --- Arquivos ---

# Entity base
create_file "$BASE/domain/entities/${KEBAB_NAME}.entity.ts" "\
import { AggregateRoot } from '../../../../shared/kernel/aggregate-root.base';
import { ${PASCAL_NAME}Id } from '../value-objects/${KEBAB_NAME}-id.value-object';

export class ${PASCAL_NAME} extends AggregateRoot<${PASCAL_NAME}Id> {
  private constructor(
    id: ${PASCAL_NAME}Id,
    // TODO: adicione propriedades da entidade
    private readonly createdAt: Date,
  ) {
    super(id);
  }

  static create(
    // TODO: adicione parâmetros de criação
  ): ${PASCAL_NAME} {
    const id = ${PASCAL_NAME}Id.generate();
    return new ${PASCAL_NAME}(id, new Date());
  }

  // TODO: adicione métodos de negócio
}
"

# Value Object ID
create_file "$BASE/domain/value-objects/${KEBAB_NAME}-id.value-object.ts" "\
import { ValueObject } from '../../../../shared/kernel/value-object.base';
import { v4 as uuidv4 } from 'uuid';

export class ${PASCAL_NAME}Id extends ValueObject {
  private constructor(public readonly value: string) {
    super();
  }

  static generate(): ${PASCAL_NAME}Id {
    return new ${PASCAL_NAME}Id(uuidv4());
  }

  static from(value: string): ${PASCAL_NAME}Id {
    return new ${PASCAL_NAME}Id(value);
  }

  equals(other: ${PASCAL_NAME}Id): boolean {
    return this.value === other.value;
  }
}
"

# Repository interface
create_file "$BASE/domain/repositories/${KEBAB_NAME}.repository.interface.ts" "\
import { ${PASCAL_NAME}PersistenceModel } from '../types/${KEBAB_NAME}.types';

export interface I${PASCAL_NAME}Repository {
  save(entity: ${PASCAL_NAME}PersistenceModel): Promise<void>;
  findById(id: string): Promise<${PASCAL_NAME}PersistenceModel | null>;
  // TODO: adicione outros métodos de repositório
}
"

# Types
create_file "$BASE/domain/types/${KEBAB_NAME}.types.ts" "\
// Tipos de persistência para ${PASCAL_NAME}
// NOTA: manter sincronizado com o schema do Prisma

export interface ${PASCAL_NAME}PersistenceModel {
  id: string;
  // TODO: adicione campos de persistência
  createdAt: Date;
  updatedAt: Date;
}
"

# DTO
create_file "$BASE/application/dto/create-${KEBAB_NAME}.dto.ts" "\
import { IsString, IsOptional } from 'class-validator';

export class Create${PASCAL_NAME}Dto {
  @IsString()
  // TODO: defina campos do DTO
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
"

# Use Case
create_file "$BASE/application/use-cases/create-${KEBAB_NAME}.use-case.ts" "\
import { Injectable } from '@nestjs/common';
import { Create${PASCAL_NAME}Dto } from '../dto/create-${KEBAB_NAME}.dto';
import { ${PASCAL_NAME} } from '../../domain/entities/${KEBAB_NAME}.entity';
import { I${PASCAL_NAME}Repository } from '../../domain/repositories/${KEBAB_NAME}.repository.interface';
import { ${PASCAL_NAME}Mapper } from '../../infrastructure/mappers/${KEBAB_NAME}.mapper';

@Injectable()
export class Create${PASCAL_NAME}UseCase {
  constructor(private readonly repository: I${PASCAL_NAME}Repository) {}

  async execute(dto: Create${PASCAL_NAME}Dto): Promise<{ id: string }> {
    const entity = ${PASCAL_NAME}.create(
      // TODO: mapear dto para entidade
    );

    const persistenceModel = ${PASCAL_NAME}Mapper.toPersistence(entity);
    await this.repository.save(persistenceModel);

    return { id: entity.id.value };
  }
}
"

# Controller
create_file "$BASE/infrastructure/controllers/create-${KEBAB_NAME}.controller.ts" "\
import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { Create${PASCAL_NAME}UseCase } from '../../application/use-cases/create-${KEBAB_NAME}.use-case';
import { Create${PASCAL_NAME}Dto } from '../../application/dto/create-${KEBAB_NAME}.dto';

@Controller('${KEBAB_NAME}')
export class Create${PASCAL_NAME}Controller {
  constructor(private readonly useCase: Create${PASCAL_NAME}UseCase) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async execute(@Body() dto: Create${PASCAL_NAME}Dto) {
    return this.useCase.execute(dto);
  }
}
"

# Mapper
create_file "$BASE/infrastructure/mappers/${KEBAB_NAME}.mapper.ts" "\
import { ${PASCAL_NAME} } from '../../domain/entities/${KEBAB_NAME}.entity';
import { ${PASCAL_NAME}PersistenceModel } from '../../domain/types/${KEBAB_NAME}.types';

export class ${PASCAL_NAME}Mapper {
  static toPersistence(entity: ${PASCAL_NAME}): ${PASCAL_NAME}PersistenceModel {
    return {
      id: entity.id.value,
      // TODO: mapear propriedades da entidade para persistência
      createdAt: entity['createdAt'], // acesso via reflect/metadados se privado
      updatedAt: new Date(),
    };
  }

  static toDomain(model: ${PASCAL_NAME}PersistenceModel): ${PASCAL_NAME} {
    // TODO: reconstruir entidade a partir do modelo de persistência
    throw new Error('Not implemented');
  }
}
"

# Repository implementation
create_file "$BASE/infrastructure/repositories/${KEBAB_NAME}.repository.ts" "\
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ${PASCAL_NAME}PersistenceModel } from '../../domain/types/${KEBAB_NAME}.types';
import { I${PASCAL_NAME}Repository } from '../../domain/repositories/${KEBAB_NAME}.repository.interface';

@Injectable()
export class ${PASCAL_NAME}Repository implements I${PASCAL_NAME}Repository {
  constructor(private readonly prisma: PrismaService) {}

  async save(data: ${PASCAL_NAME}PersistenceModel): Promise<void> {
    await this.prisma.${SNAKE_NAME}.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<${PASCAL_NAME}PersistenceModel | null> {
    return this.prisma.${SNAKE_NAME}.findUnique({ where: { id } });
  }
}
"

# Unit test (use case)
create_file "$BASE/application/use-cases/create-${KEBAB_NAME}.use-case.spec.ts" "\
import { Test } from '@nestjs/testing';
import { Create${PASCAL_NAME}UseCase } from './create-${KEBAB_NAME}.use-case';
import { I${PASCAL_NAME}Repository } from '../../domain/repositories/${KEBAB_NAME}.repository.interface';

describe('Create${PASCAL_NAME}UseCase', () => {
  let useCase: Create${PASCAL_NAME}UseCase;
  let repository: jest.Mocked<I${PASCAL_NAME}Repository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        Create${PASCAL_NAME}UseCase,
        { provide: I${PASCAL_NAME}Repository, useValue: { save: jest.fn(), findById: jest.fn() } },
      ],
    }).compile();

    useCase = module.get(Create${PASCAL_NAME}UseCase);
    repository = module.get(I${PASCAL_NAME}Repository);
  });

  it('should create a ${KEBAB_NAME} successfully', async () => {
    const result = await useCase.execute({ name: 'Test' });
    expect(result.id).toBeDefined();
    expect(repository.save).toHaveBeenCalled();
  });
});
"

# Integration test
create_file "$BASE/tests/${KEBAB_NAME}.integration.spec.ts" "\
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Create${PASCAL_NAME}UseCase } from '../application/use-cases/create-${KEBAB_NAME}.use-case';
import { ${PASCAL_NAME}Repository } from '../infrastructure/repositories/${KEBAB_NAME}.repository';

describe('${PASCAL_NAME} Integration', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let useCase: Create${PASCAL_NAME}UseCase;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    prisma = new PrismaClient({
      datasources: { db: { url: container.getConnectionString() } },
    });
    await prisma.\$connect();
  });

  afterAll(async () => {
    await prisma.\$disconnect();
    await container.stop();
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        Create${PASCAL_NAME}UseCase,
        { provide: ${PASCAL_NAME}Repository, useFactory: () => new ${PASCAL_NAME}Repository(prisma as any) },
      ],
    }).compile();

    useCase = module.get(Create${PASCAL_NAME}UseCase);
  });

  it('should persist and retrieve a ${KEBAB_NAME}', async () => {
    // TODO: implementar teste de integração
  });
});
"

echo ""
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "🔍 Dry-run completo. Nenhum arquivo foi alterado."
  echo ""
  echo "Estrutura que seria criada em $BASE/:"
  find "$BASE" -type f -o -type d 2>/dev/null | sort || true
else
  echo "✅ Slice '$KEBAB_NAME' criado com sucesso em '$BASE/'!"
  echo ""
  echo "Próximos passos:"
  echo "  1. Edite o schema do Prisma para incluir a tabela '$SNAKE_NAME'"
  echo "  2. Execute 'npx prisma migrate dev --name create-$KEBAB_NAME'"
  echo "  3. Registre o módulo no NestJS (import em app.module.ts)"
  echo "  4. Preencha os TODOs nos arquivos gerados"
  echo "  5. Execute os testes: npm test -- --testPathPattern='$KEBAB_NAME'"
fi
