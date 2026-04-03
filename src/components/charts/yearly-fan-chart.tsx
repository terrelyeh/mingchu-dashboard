"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

type FanSnapshot = {
  year: number
  facebook: number
  instagram: number
  total: number
}

export function YearlyFanChart({ data }: { data: FanSnapshot[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center text-muted-foreground">
        尚無資料
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 13 }}
          stroke="var(--muted-foreground)"
        />
        <YAxis
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
          }
          tick={{ fontSize: 13 }}
          stroke="var(--muted-foreground)"
        />
        <Tooltip
          formatter={(value, name) => [
            Number(value).toLocaleString("zh-TW"),
            name === "facebook" ? "Facebook" : name === "instagram" ? "Instagram" : "總計",
          ]}
          labelFormatter={(label) => `${label} 年`}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
          }}
        />
        <Legend
          formatter={(value: string) =>
            value === "facebook" ? "Facebook" : value === "instagram" ? "Instagram" : "總計"
          }
        />
        <Bar
          dataKey="facebook"
          stackId="fans"
          fill="var(--fb-blue)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="instagram"
          stackId="fans"
          fill="var(--ig-pink)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
