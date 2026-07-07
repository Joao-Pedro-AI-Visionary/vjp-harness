# Vertical Slice + DDD

**Tier:** skill · **Versão pinada:** `1.0.0` · **Origem:** skill nativa do ecossistema VJP Harness · **Destino:** `.harness/tools/vertical-slice-ddd.md`

## Responsabilidade
Padrão arquitetural que combina **Vertical Slice** com **Domain-Driven Design (DDD)** para organizar código por feature em vez de camada técnica. Cada feature do domínio é um "slice" vertical que atravessa Controller → DTO → Use Case → Repository, mantendo todas as camadas da feature isoladas em um único módulo.

## Papel no pipeline
`PLANNER → RESEARCHER → EXECUTOR → REVIEWER`. O Vertical Slice é o padrão que o **EXECUTOR** deve seguir ao gerar código. O **RESEARCHER** mapeia quais slices serão impactados. O **PLANNER** avalia riscos por slice. O **REVIEWER** valida o isolamento dos slices.

## Quando usar
- Projetos com múltiplas features de negócio independentes
- Times grandes onde diferentes agentes/desenvolvedores trabalham em paralelo
- Domínios com regras de negócio complexas (DDD brilha aqui)
- Microserviços ou monolitos modulares que precisam evoluir sem acoplamento
- Sempre que o ADR-002 estiver ativo no projeto

## Estrutura de Diretórios Sugerida

```
src/
  shared/                          # Código compartilhado entre slices
    kernel/                        # DDD building blocks (base classes)
      entity.base.ts
      value-object.base.ts
      aggregate-root.base.ts
      domain-event.base.ts
      repository.base.ts
    infrastructure/                # Infra global (database, cache, etc.)
      database/
      cache/
      messaging/
    utils/
      errors/
      guards/

  modules/                         # Feature modules (slices verticais)
    <feature-name>/                # Ex: billing, identity, catalog
      application/                 # Casos de uso da feature
        use-cases/
          <action>.use-case.ts
        dto/
          <action>.dto.ts
          <action>.dto.spec.ts
        interfaces/
          <feature>-facade.ts      # Facade opcional para expor ao mundo externo

      domain/                      # Regras de negócio puras (DDD)
        entities/
          <entity>.entity.ts
        value-objects/
          <vo>.value-object.ts
        aggregates/
          <aggregate>.aggregate.ts
        domain-events/
          <event>.domain-event.ts
        domain-services/
          <service>.domain-service.ts
        specifications/            # Specifications (DDD)
          <spec>.specification.ts

      infrastructure/              # Adaptadores e implementações concretas
        controllers/               # Entrada HTTP
          <action>.controller.ts
          <action>.controller.spec.ts
        repositories/              # Implementação do repositório (Prisma, etc.)
          <entity>.repository.ts
          <entity>.repository.spec.ts
        mappers/                   # Mappers entre domínio e persistência
          <entity>.mapper.ts
        subscribers/               # Subscribers de eventos de domínio
          <event>.subscriber.ts

      tests/                       # Testes de integração do slice
        <feature>.integration.spec.ts

    <outra-feature>/
      application/
      domain/
      infrastructure/
      tests/
```

## Exemplo de Slice Completo

### Controller (infrastructure/controllers)

```typescript
// modules/billing/infrastructure/controllers/create-invoice.controller.ts
import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.use-case';
import { CreateInvoiceDto } from '../../application/dto/create-invoice.dto';

@Controller('billing/invoices')
export class CreateInvoiceController {
  constructor(private readonly useCase: CreateInvoiceUseCase) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async execute(@Body() dto: CreateInvoiceDto) {
    return this.useCase.execute(dto);
  }
}
```

### DTO (application/dto)

```typescript
// modules/billing/application/dto/create-invoice.dto.ts
import { IsString, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class InvoiceLineDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateInvoiceDto {
  @IsString()
  customerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines: InvoiceLineDto[];
}
```

### Entity (domain/entities)

```typescript
// modules/billing/domain/entities/invoice.entity.ts
import { AggregateRoot } from '../../../../shared/kernel/aggregate-root.base';
import { InvoiceId } from '../value-objects/invoice-id.value-object';
import { Money } from '../value-objects/money.value-object';
import { InvoiceStatus } from '../value-objects/invoice-status.value-object';
import { InvoiceLine } from './invoice-line.entity';
import { InvoiceCreatedEvent } from '../domain-events/invoice-created.domain-event';

export class Invoice extends AggregateRoot<InvoiceId> {
  private constructor(
    id: InvoiceId,
    private readonly customerId: string,
    private lines: InvoiceLine[],
    private total: Money,
    private status: InvoiceStatus,
    private readonly createdAt: Date,
  ) {
    super(id);
  }

  static create(customerId: string, lines: InvoiceLine[]): Invoice {
    const id = InvoiceId.generate();
    const total = lines.reduce((acc, line) => acc.add(line.subtotal), Money.zero());
    const invoice = new Invoice(id, customerId, lines, total, InvoiceStatus.Pending(), new Date());

    invoice.addDomainEvent(new InvoiceCreatedEvent(id, customerId, total));
    return invoice;
  }

  markAsPaid(): void {
    if (!this.status.isPending()) {
      throw new Error('Only pending invoices can be marked as paid');
    }
    this.status = InvoiceStatus.Paid();
  }

  getTotal(): Money {
    return this.total;
  }
}
```

### Value Object (domain/value-objects)

```typescript
// modules/billing/domain/value-objects/money.value-object.ts
import { ValueObject } from '../../../../shared/kernel/value-object.base';

export class Money extends ValueObject {
  private constructor(public readonly amount: number, public readonly currency: string) {
    super();
  }

  static from(amount: number, currency: string = 'BRL'): Money {
    if (amount < 0) throw new Error('Amount must be non-negative');
    return new Money(amount, currency);
  }

  static zero(currency: string = 'BRL'): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
    return Money.from(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

### Use Case (application/use-cases)

```typescript
// modules/billing/application/use-cases/create-invoice.use-case.ts
import { Injectable } from '@nestjs/common';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { Invoice } from '../../domain/entities/invoice.entity';
import { InvoiceLine } from '../../domain/entities/invoice-line.entity';
import { IInvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { InvoiceMapper } from '../../infrastructure/mappers/invoice.mapper';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(private readonly invoiceRepository: IInvoiceRepository) {}

  async execute(dto: CreateInvoiceDto): Promise<{ id: string }> {
    const lines = dto.lines.map(
      line => InvoiceLine.create(line.description, line.quantity, line.unitPrice),
    );

    const invoice = Invoice.create(dto.customerId, lines);
    const persistenceModel = InvoiceMapper.toPersistence(invoice);

    await this.invoiceRepository.save(persistenceModel);

    return { id: invoice.id.value };
  }
}
```

### Repository (domain/repositories — interface)

```typescript
// modules/billing/domain/repositories/invoice.repository.interface.ts
import { InvoicePersistenceModel } from '../types/invoice.types';

export interface IInvoiceRepository {
  save(invoice: InvoicePersistenceModel): Promise<void>;
  findById(id: string): Promise<InvoicePersistenceModel | null>;
  findByCustomerId(customerId: string): Promise<InvoicePersistenceModel[]>;
}
```

### Repository (infrastructure/repositories — implementação)

```typescript
// modules/billing/infrastructure/repositories/invoice.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { InvoicePersistenceModel } from '../../domain/types/invoice.types';
import { IInvoiceRepository } from '../../domain/repositories/invoice.repository.interface';

@Injectable()
export class InvoiceRepository implements IInvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(invoice: InvoicePersistenceModel): Promise<void> {
    await this.prisma.invoice.upsert({
      where: { id: invoice.id },
      create: invoice,
      update: invoice,
    });
  }

  async findById(id: string): Promise<InvoicePersistenceModel | null> {
    return this.prisma.invoice.findUnique({ where: { id } });
  }

  async findByCustomerId(customerId: string): Promise<InvoicePersistenceModel[]> {
    return this.prisma.invoice.findMany({ where: { customerId } });
  }
}
```

## Como o EXECUTOR deve gerar código seguindo esse pattern

1. **Identifique o slice**: toda nova feature que atravesse Controller → Use Case → Repository é um novo diretório em `src/modules/<feature-name>/`.

2. **Sempre comece pelo domínio**: modele as entidades, value objects e aggregates primeiro. O Use Case só existe para orquestrar o domínio.

3. **Mantenha o domínio puro**: entities, value objects e domain services **não devem importar nada de infraestrutura** (NestJS, Prisma, HTTP). Eles são funções/classes puras.

4. **DTOs na camada application**: DTOs validam entrada. Eles são a fronteira entre o mundo externo (HTTP) e o caso de uso.

5. **Controllers são finos**: só roteiam, validam com DTO, chamam o use case. Sem lógica de negócio.

6. **Repositories**: a interface fica no domínio (`domain/repositories/`), a implementação concreta em `infrastructure/repositories/`. Isso permite trocar de ORM sem tocar no domínio.

7. **Mappers**: convertem entre entidades de domínio e modelos de persistência. Use mappers explícitos, não acople o domínio ao Prisma.

8. **Testes por slice**: cada slice tem:
   - Testes unitários do Use Case (com repositório mockado)
   - Testes unitários das Entidades/Value Objects
   - Testes de integração do Controller (com Testcontainers)

9. **Um arquivo por conceito**: `CreateInvoiceUseCase`, `CreateInvoiceDto`, `Invoice`, `Money`. Não agrupe use cases em um arquivo gigante.

10. **Referencie este documento**: o EXECUTOR deve ler este `.md` antes de começar a codificar cada nova feature.

## Referências

- **ADR-002**: Vertical Slice + DDD as Default Architecture (ver `seed/gbrain/decisions.md`)
- **GBrain Architecture**: `seed/gbrain/architecture.md` (seção "Vertical Slice + DDD")
- **AGENT_RULES.md**: seção do EXECUTOR com diretrizes adicionais
- **Patterns**: `seed/gbrain/patterns.md` (padrão de controller NestJS + Testcontainers)

## Determinismo
Skill nativa do ecossistema VJP Harness. A spec está vendorizada neste documento em `.harness/tools/vertical-slice-ddd.md`.
