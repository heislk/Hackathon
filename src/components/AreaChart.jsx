import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const defaultData = [
  { year: "2022", stolen: 3.7 },
  { year: "2023", stolen: 1.8 },
  { year: "2024", stolen: 2.2 },
  { year: "2025", stolen: 3.4 },
];

function formatBillions(value) {
  return `$${value.toFixed(1)}B`;
}

export default function AreaChartComponent({
  data = defaultData,
  ariaLabel = "Crypto theft by year",
}) {
  return (
    <div className="mission-chart" aria-label={ariaLabel} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="stolenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff7a59" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ff7a59" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey="year"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(255, 255, 255, 0.72)", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(255, 255, 255, 0.72)", fontSize: 12 }}
            tickFormatter={formatBillions}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255, 122, 89, 0.35)" }}
            contentStyle={{
              background: "#0f1524",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "14px",
              color: "#f8fafc",
              boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
            }}
            labelStyle={{ color: "#f8fafc", fontWeight: 700 }}
            formatter={(value) => [formatBillions(Number(value)), "Stolen"]}
          />
          <Area
            type="monotone"
            dataKey="stolen"
            stroke="#ff7a59"
            strokeWidth={3}
            fill="url(#stolenGradient)"
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
