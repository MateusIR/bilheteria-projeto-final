import type { Ingresso, Pessoa, TipoIngresso } from "./tipos.ts";

const TAXA_DE_SERVICO = 0.1;

// recebe o preço base e devolve a função que calcula o valor de um tipo.
export const valorDoIngresso =
  (precoBase: number) =>
  (tipo: TipoIngresso): number =>
    tipo === "meia" ? Math.round((precoBase / 2) * 100) / 100 : precoBase;

// recebe o percentual e devolve a função que soma a taxa a um valor.
export const aplicarTaxa =
  (percentual: number) =>
  (valor: number): number =>
    Math.round(valor * (1 + percentual) * 100) / 100;

// Um Ingresso por pessoa, na mesma ordem. Quem decide a meia é a função recebida.
export const montarIngressos = (
  precoBase: number,
  pessoas: readonly Pessoa[],
  temDireitoAMeia: (pessoa: Pessoa) => boolean,
): Ingresso[] =>
  pessoas.map((pessoa) => {
    const tipo: TipoIngresso = temDireitoAMeia(pessoa) ? "meia" : "inteira";
    return {
      nome: pessoa.nome,
      poltrona: pessoa.poltrona,
      tipo,
      valor: valorDoIngresso(precoBase)(tipo),
    };
  });

// Soma com reduce e aplica a taxa de 10%.
export const calcularTotal = (ingressos: readonly Ingresso[]): number =>
  aplicarTaxa(TAXA_DE_SERVICO)(
    ingressos.reduce((soma, ingresso) => soma + ingresso.valor, 0),
  );
