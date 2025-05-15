// src/components/VillageTable.jsx
export default function VillageTable({ rows, fmt }) {
  return (
    <div className="bg-gray-100 rounded-xl p-6 shadow mt-10">
      <h3 className="text-lg font-semibold mb-4 text-gray-700 text-center">📍 데이터 지도</h3>
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-sm">
          <thead className="bg-gray-200 sticky top-0">
            <tr>
              <th className="px-2 py-1">시/도</th>
              <th className="px-2 py-1">시/군/구</th>
              <th className="px-2 py-1">업로드 수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.region}-${r.district}`} className="odd:bg-white even:bg-gray-50">
                <td className="px-2 py-1 whitespace-nowrap">{r.region}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.district}</td>
                <td className="px-2 py-1 text-right">{fmt(r.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
