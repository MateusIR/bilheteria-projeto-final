// A venda. Parte C: tempo limite na operadora (e devolução se o pagamento falhar).
import {
  DadosInvalidosErro,
  Evento,
  NaoEncontradoErro,
  PagamentoErro,
} from "./dominio.ts";
import type { Pagamento } from "./pagamento.ts";
import { calcularTotal, montarIngressos } from "./preco.ts";
import { direitoAMeia } from "./regras.ts";
import type {
  Comprovante,
  ConfigBilheteria,
  EventoInfo,
  Pedido,
} from "./tipos.ts";

// C: corrida entre a cobrança e um relógio. Quem terminar primeiro decide.
function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error("tempo esgotado")), ms);
  });
  // O finally desliga o relógio quando a cobrança termina antes.
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

export class Bilheteria {
  #eventos: Evento[];
  #pagar: Pagamento;
  #limitePagamentoMs: number;
  #ultimaReserva = 0; // contador do reservaId

  constructor(config: ConfigBilheteria) {
    this.#eventos = config.eventos;
    this.#pagar = config.pagar;
    this.#limitePagamentoMs = config.limitePagamentoMs;
  }

  listarEventos(): EventoInfo[] {
    return this.#eventos.map((evento) => evento.info());
  }

  async reservar(pedido: Pedido): Promise<Comprovante> {
    // 1. confere o pedido e procura o evento
    if (!pedido || !Array.isArray(pedido.ingressos) || pedido.ingressos.length === 0) {
      throw new DadosInvalidosErro("o pedido precisa de pelo menos um ingresso");
    }
    const evento = this.#eventos.find((e) => e.id === pedido.eventoId);
    if (!evento) {
      throw new NaoEncontradoErro(`evento ${pedido.eventoId} não existe`);
    }

    // 2. marca as poltronas ANTES do await (PoltronaOcupadaErro sai daqui, sem cobrar)
    const poltronas = pedido.ingressos.map((pessoa) => pessoa.poltrona);
    evento.reservar(poltronas);

    // 3. ingressos e total
    const ingressos = montarIngressos(evento.preco, pedido.ingressos, direitoAMeia);
    const total = calcularTotal(ingressos);

    // 4. cobra: o único await da venda (recusa e tempo esgotado caem no mesmo catch)
    try {
      await comTempoLimite(this.#pagar(total), this.#limitePagamentoMs); // C
    } catch {
      evento.liberar(poltronas); // B: devolve as poltronas que ninguém pagou
      throw new PagamentoErro("a operadora não aprovou o pagamento");
    }

    // 5. comprovante, com reservaId novo a cada compra
    this.#ultimaReserva += 1;
    return {
      reservaId: this.#ultimaReserva,
      eventoId: evento.id,
      ingressos,
      total,
    };
  }
}

export function criarBilheteria(config: ConfigBilheteria): Bilheteria {
  return new Bilheteria(config);
}
