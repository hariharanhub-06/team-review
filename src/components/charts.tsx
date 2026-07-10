"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";

export const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
] as const;

type Datum = Record<string, any>;

type SeriesDef = {
  key: string;
  name: string;
  color?: string;
};

const CHART_HEIGHT = 300;

const axisProps = {
  stroke: "currentColor",
  tick: { fontSize: 12, fill: "currentColor" },
  tickLine: { stroke: "currentColor" },
  axisLine: { stroke: "hsl(var(--border))" },
} as const;

const tooltipContentStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
} as const;

const tooltipStyleProps = {
  contentStyle: tooltipContentStyle,
  labelStyle: { color: "hsl(var(--card-foreground))" },
  itemStyle: { color: "hsl(var(--card-foreground))" },
  cursor: { fill: "hsl(var(--muted))", fillOpacity: 0.2 },
} as const;

function EmptyState() {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height: CHART_HEIGHT }}
    >
      No data for this period
    </div>
  );
}

function ChartShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function BarChartCard({
  title,
  data,
  xKey,
  bars,
}: {
  title: string;
  data: Datum[];
  xKey: string;
  bars: SeriesDef[];
}) {
  const isEmpty = !data || data.length === 0 || bars.length === 0;
  return (
    <ChartShell title={title}>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={data} className="text-muted-foreground">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.4}
              vertical={false}
            />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip {...tooltipStyleProps} />
            {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {bars.map((b, i) => (
              <Bar
                key={b.key}
                dataKey={b.key}
                name={b.name}
                fill={b.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

export function LineChartCard({
  title,
  data,
  xKey,
  lines,
}: {
  title: string;
  data: Datum[];
  xKey: string;
  lines: SeriesDef[];
}) {
  const isEmpty = !data || data.length === 0 || lines.length === 0;
  return (
    <ChartShell title={title}>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data} className="text-muted-foreground">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.4}
              vertical={false}
            />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip {...tooltipStyleProps} />
            {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {lines.map((l, i) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.name}
                stroke={l.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

export function PieChartCard({
  title,
  data,
  nameKey,
  valueKey,
}: {
  title: string;
  data: Datum[];
  nameKey: string;
  valueKey: string;
}) {
  const isEmpty =
    !data ||
    data.length === 0 ||
    data.every((d) => !d[valueKey] || Number(d[valueKey]) === 0);
  return (
    <ChartShell title={title}>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <PieChart className="text-muted-foreground">
            <Tooltip {...tooltipStyleProps} cursor={false} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={45}
              paddingAngle={2}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}
