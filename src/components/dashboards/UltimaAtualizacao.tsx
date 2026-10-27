import { C } from "@/components/dashboards/palette";

/**
 * Quando os numeros do painel foram importados do Shop9 pela ultima vez.
 * Fica ao lado do titulo para a pessoa saber se esta olhando dado de hoje
 * ou da semana passada — a importacao roda toda segunda as 10h.
 */
export function UltimaAtualizacao({ em }: { em: string | null }) {
  if (!em) {
    return (
      <span className="text-sm" style={{ color: C.ink, opacity: 0.55 }}>
        sem importação registrada
      </span>
    );
  }

  const data = new Date(em);
  const formatado = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(data);

  const horas = (Date.now() - data.getTime()) / 3_600_000;
  // a importacao e semanal; passando de 8 dias algo deixou de rodar
  const atrasado = horas > 24 * 8;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
      style={{
        background: atrasado ? "#FBE9E7" : C.tan,
        color: atrasado ? "#B03A2E" : C.ink,
      }}
      title={
        atrasado
          ? "A importação do Shop9 não roda há mais de 8 dias. Verifique a tarefa agendada e a VPN."
          : "Importação do Shop9, que roda toda segunda às 10h."
      }
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: atrasado ? "#B03A2E" : C.brown }}
      />
      Atualizado em {formatado}
    </span>
  );
}
