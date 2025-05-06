import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, CartesianGrid,
} from 'recharts';

const data = [
  { keyword: '시장', count: 40 },
  { keyword: '문화센터', count: 30 },
  { keyword: '건강', count: 25 },
  { keyword: '도서관', count: 20 },
  { keyword: '체육시설', count: 18 },
];

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-300 p-2 rounded shadow text-sm">
        <strong>{payload[0].payload.keyword}</strong>: {payload[0].payload.count}회 등장
      </div>
    );
  }
  return null;
};

export default function TextFrequencyChart() {
  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 30, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorBar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a5b4fc" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis
            dataKey="keyword"
            type="category"
            width={100}
            tick={{ fontSize: 14, fill: '#374151' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" fill="url(#colorBar)" radius={[0, 6, 6, 0]}>
            <LabelList dataKey="count" position="right" fill="#374151" fontSize={12} />
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
