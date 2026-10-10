import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { Faq } from './entities/faq.entity';

/**
 * Texto del 400 de `reordenar`: la lista que mandó la dueña no es la que hay
 * en la base (otra pestaña añadió o borró una pregunta mientras ordenaba).
 */
export const ORDEN_DESACTUALIZADO =
  'La lista de preguntas cambió mientras la ordenabas: recarga la página y vuelve a intentarlo';

@Injectable()
export class FaqsService {
  private readonly logger = new Logger('FaqsService');

  constructor(
    @InjectRepository(Faq)
    private readonly faqRepository: Repository<Faq>,
  ) {}

  /**
   * Una pregunta nueva entra AL FINAL (`max(sortOrder) + 1`). Antes entraba
   * con 0 y aparecía arriba del todo, empatada con la primera. Si quien llama
   * manda un `sortOrder` explícito, se respeta.
   */
  async create(createFaqDto: CreateFaqDto) {
    const sortOrder = createFaqDto.sortOrder ?? (await this.siguientePuesto());

    const faq = this.faqRepository.create({
      ...createFaqDto,
      question: createFaqDto.question.trim(),
      answer: createFaqDto.answer.trim(),
      sortOrder,
    });

    return this.faqRepository.save(faq);
  }

  async findAll() {
    return this.faqRepository.find({
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async findOne(id: string) {
    const faq = await this.faqRepository.findOneBy({ id });
    if (!faq) {
      throw new NotFoundException(`FAQ with id ${id} was not found`);
    }

    return faq;
  }

  async update(id: string, updateFaqDto: UpdateFaqDto) {
    const faq = await this.findOne(id);

    if (typeof updateFaqDto.question === 'string') {
      faq.question = updateFaqDto.question.trim();
    }
    if (typeof updateFaqDto.answer === 'string') {
      faq.answer = updateFaqDto.answer.trim();
    }
    if (typeof updateFaqDto.sortOrder === 'number') {
      faq.sortOrder = updateFaqDto.sortOrder;
    }

    return this.faqRepository.save(faq);
  }

  /**
   * Reescribe el orden entero: `ids[0]` pasa a `sortOrder` 0, `ids[1]` a 1…
   *
   * Todo en una transacción y con las filas bloqueadas (`FOR UPDATE`): dos
   * órdenes simultáneos se aplican uno detrás de otro, nunca mezclados. Si
   * `ids` no es exactamente el conjunto de preguntas que hay —falta, sobra, se
   * repite o se cambia una—, no se escribe nada y se responde 400.
   */
  async reordenar(ids: string[]): Promise<Faq[]> {
    return this.faqRepository.manager.transaction(async (manager) => {
      const repositorio = manager.getRepository(Faq);
      const actuales = await repositorio.find({
        select: { id: true, sortOrder: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !esElMismoConjunto(
          ids,
          actuales.map((faq) => faq.id),
        )
      ) {
        throw new BadRequestException(ORDEN_DESACTUALIZADO);
      }

      const puestoActual = new Map(
        actuales.map((faq): [string, number] => [faq.id, faq.sortOrder]),
      );
      for (let puesto = 0; puesto < ids.length; puesto += 1) {
        const id = ids[puesto];
        if (puestoActual.get(id) !== puesto) {
          await repositorio.update({ id }, { sortOrder: puesto });
        }
      }

      return repositorio.find({
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
    });
  }

  async remove(id: string) {
    const faq = await this.findOne(id);

    try {
      await this.faqRepository.remove(faq);
      return { deleted: true };
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Unexpected error');
    }
  }

  /** El puesto que sigue al último; 0 con la tabla vacía. */
  private async siguientePuesto(): Promise<number> {
    const maximo = await this.faqRepository.maximum('sortOrder');
    return maximo === null || maximo === undefined ? 0 : Number(maximo) + 1;
  }
}

/** ¿Son los mismos ids, sin repetidos, sin que falte ni sobre ninguno? */
function esElMismoConjunto(pedidos: string[], existentes: string[]): boolean {
  const conocidos = new Set(existentes);
  return (
    pedidos.length === conocidos.size &&
    new Set(pedidos).size === pedidos.length &&
    pedidos.every((id) => conocidos.has(id))
  );
}
