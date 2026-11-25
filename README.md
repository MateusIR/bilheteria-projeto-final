# Bilheteria concorrente

Projeto final de Paradigmas de Linguagens de Programação. Enunciado completo no Blackboard.

Os arquivos de `src/` que vocês escrevem já existem, vazios; o `tipos.ts` e o `servidor.ts` vêm prontos. O que vai em cada um está no passo
indicado do enunciado:

| Arquivo | Passo do enunciado |
| :--- | :--- |
| `src/tipos.ts` (pronto) | 1: os tipos |
| `src/regras.ts` | 2: meia-entrada |
| `src/preco.ts` | 3: preço (funcional) |
| `src/dominio.ts` | 4: evento e erros (orientado a objetos) |
| `src/bilheteria.ts` | 5: a venda, onde a concorrência aparece |
| `src/servidor.ts` (pronto) e `src/main.ts` | 6: ligar o servidor |

Não alterem `src/pagamento.ts`, `src/servidor.ts`, `src/bench.ts` nem `testes/`: a correção usa os originais.

Para começar, sigam o `GUIA.md`. Depois dele, os comandos são:

```bash
npm install
npm test          # correção automática: mostra os pontos
npm start         # serviço em http://localhost:3000
npm run bench     # com o serviço no ar: 200 pedidos simultâneos no evento 1, dois por poltrona
```

Exemplo de pedido:

```bash
curl -X POST localhost:3000/reservas -H 'Content-Type: application/json' \
  -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
```

---

## Preencham (avaliado no vídeo)

**Link do vídeo:** https://youtu.be/f23jpP00L-A

### Integrantes

| Nome | Usuário do GitHub | Parte principal |
| :--- | :--- | :--- |
| Mateus Ieno - 34374621 | MateusIR | `regras.ts`, `preco.ts` e `dominio.ts`, |
| Heitor Mamede - 32825501 | Heitorrk | `bilheteria.ts` |

### Decisões

1. **Concorrência.** O `evento.reservar(poltronas)` marca as poltronas **antes** do único `await` da venda
   (o `await comTempoLimite(pagar(total), ...)`). Entre ler "está livre?" e gravar "agora é meu" não há nenhum
   `await`, então o Node não troca de pedido no meio: quem chega depois recebe 409 na hora, sem ser cobrado. O
   `await` perigoso seria cobrar primeiro e marcar depois: os 200 pedidos leriam "livre" e pagariam todos
   (é o estoque com bug da Aula 9). Se o pagamento falha ou estoura o tempo, o `catch` chama `evento.liberar`.
2. **OO.** O `Evento` esconde a lista de poltronas vendidas (`#vendidas`): de fora só se lê `disponivel`, então
   ninguém põe o evento num estado inválido (ex.: `evento.disponivel = 999` não muda nada). O `reservar` é tudo
   ou nada porque um pedido de família não pode ficar pela metade: conferimos todas as poltronas e só depois
   marcamos. Os erros são uma hierarquia (`ErroDeNegocio` → 4 filhas) para o servidor tratar todos com um único
   `instanceof ErroDeNegocio` e responder com o `status` que cada erro carrega.
3. **Funcional.** Funções puras (mesma entrada, mesma saída, sem efeito colateral) são fáceis de testar sem
   servidor, sem relógio e sem operadora: `calcularTotal(ingressos)` direto, com `assert`. Também podem ser
   chamadas por vários pedidos ao mesmo tempo sem risco, porque não guardam estado.
4. **Se fosse em outro paradigma.** O `preco.ts` em OO seria uma classe `CalculadoraDePreco` com preço base e
   taxa como campos. Funcionaria, mas ganharia estado e cerimônia sem necessidade: para uma conta, funções
   puras e composição são mais curtas e mais fáceis de testar. Já o `Evento` em estilo funcional puro
   (devolvendo um novo evento a cada reserva) ficaria pior, porque a bilheteria precisaria guardar e trocar
   a referência do evento, e isso reabriria a corrida.
5. **Concorrente × paralelo.** Nosso código é concorrente: uma linha de execução alterna entre pedidos enquanto
   eles esperam a operadora. Em vários núcleos de fato ao mesmo tempo, `evento.reservar` deixaria de ser
   atômico: duas threads poderiam ver a poltrona livre juntas e vender duas vezes. Seria preciso trava
   (mutex), operação atômica ou fila por evento, e passaríamos a lidar com deadlock e contenção.

### Resultados do bench

| Cenário | Pedidos | Tempo (ms) | Vendidos | Poltrona ocupada | Falha de pagamento |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Padrão (`main.ts`) | 200 | 119 | 90 | 100 | 10 |

O bench ocupa as poltronas do evento 1: para rodar de novo, parem o `npm start` (Ctrl+C) e subam outra
vez.

O que os números mostram:
Dos 200 pedidos (dois para cada uma das 100 poltronas do evento 1), 90 viraram venda (201), 100 foram recusados
por poltrona ocupada (409, o segundo pedido de cada poltrona, sem cobrança) e 10 tiveram pagamento recusado (502,
a operadora falsa falha 10% das vezes e as poltronas voltam para a venda). Os 200 pedidos terminaram em ~119 ms,
perto de uma única latência da operadora (80 ms): se esperassem uns pelos outros levariam 200 × 80 ms = 16 s. Os
números de vendidos e 502 variam a cada execução; a soma sempre dá 200.
