import { Bar } from 'react-chartjs-2';

export default function TextFrequencyChart({ data, options }) {
  return (
    <div className="bg-gray-50 rounded-xl p-6 shadow">
      <h3 className="text-lg font-semibold mb-4 text-gray-700">🔥 매우 들어가는 키워드</h3>
      {data ? <Bar data={data} options={options} height={300} />
            : <p className="text-sm text-gray-500">로딩…</p>}
    </div>
  );
}
