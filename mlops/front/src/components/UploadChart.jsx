import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// 📌 Chart.js 필수 요소 등록 (한 번만 실행됨)
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function UploadChart({ data, options }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow">
      <h3 className="text-lg font-bold mb-6 text-gray-800">지역별 업로드 수</h3>
      {data ? (
        <Bar data={data} options={options} height={300} />
      ) : (
        <p className="text-sm text-gray-500">로딩…</p>
      )}
    </div>
  );
}
