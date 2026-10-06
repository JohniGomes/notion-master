"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { brl, brl2, C, Empty } from "@/components/dashboards/theme";

export type ComboDatum = { name: string; label: string; valor: number; linha?: number };

const moneyLabel = (v: unknown) => (Number(v) > 0 ? brl.format(Number(v)) : "");

// Etiqueta dourada para os pontos da linha (fica visualmente separada dos valores das colunas).
function LineTag({
  x,
  y,
  value,
  format,
}: {
  x?: number | string;
  y?: number | string;
  value?: unknown;
  format: (v: unknown) => string;
}) {
  const px = Number(x);
  const py = Number(y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  const text = format(value);
  const width = text.length * 5.6 + 10;
  return (
    <g>
      <rect x={px - width / 2} y={py - 22} width={width} height={15} rx={4} fill={C.gold} />
      <text x={px} y={py - 11} textAnchor="middle" fontSize={9} fontWeight={600} fill="#fff">
        {text}
      </text>
    </g>
  );
}

/**
 * Colunas + linha sem sobreposicao: as colunas ocupam a metade de baixo do grafico e a
 * linha a metade de cima (cada serie com seu proprio eixo escondido), entao os numeros
 * das colunas e os da linha nunca se encontram.
 */
export function ComboChart({
  data,
  barName = "R$",
  lineName,
  lineFormat = (v) => String(v),
  tooltipLineFormat,
  height = 300,
}: {
  data: ComboDatum[];
  barName?: string;
  lineName?: string;
  lineFormat?: (v: unknown) => string;
  tooltipLineFormat?: (v: unknown) => string;
  height?: number;
}) {
  if (data.length === 0) return <Empty />;

  const showLine = !!lineName;
  const maxBar = Math.max(1, ...data.map((d) => d.valor));
  const maxLine = Math.max(1, ...data.map((d) => d.linha ?? 0));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 12, left: 64, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ece7da" />
          <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={72} fontSize={9} tickLine={false} />
          <YAxis yAxisId="valor" hide domain={[0, showLine ? maxBar * 1.9 : maxBar * 1.15]} />
          <YAxis yAxisId="linha" hide orientation="right" domain={[-maxLine * 2, maxLine * 1.25]} />
          <Tooltip
            formatter={(v, name) =>
              name === lineName ? (tooltipLineFormat ?? lineFormat)(v) : brl2.format(Number(v))
            }
            labelFormatter={(_, payload) => String(payload?.[0]?.payload?.name ?? "")}
          />
          <Bar yAxisId="valor" dataKey="valor" name={barName} fill={C.brown} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="valor" position="top" formatter={moneyLabel} fontSize={9} fill={C.ink} />
          </Bar>
          {showLine && (
            <Line
              yAxisId="linha"
              dataKey="linha"
              name={lineName}
              stroke={C.gold}
              strokeWidth={2}
              dot={{ r: 3, fill: C.gold }}
            >
              <LabelList
                dataKey="linha"
                content={(p) => <LineTag {...(p as { x?: number; y?: number; value?: unknown })} format={lineFormat} />}
              />
            </Line>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
