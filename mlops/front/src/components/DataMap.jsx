import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 마커 아이콘 설정 (Vite 환경 대응)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// 정릉/길음 관련 샘플 데이터
const sampleData = [
  {
    id: 1,
    title: '정릉시장',
    lat: 37.6026,
    lng: 127.0168,
    summary: '정릉 주민 생활 중심지',
  },
  {
    id: 2,
    title: '길음 청소년문화의집',
    lat: 37.6122,
    lng: 127.0255,
    summary: '지역 청소년의 활동 공간',
  },
  {
    id: 3,
    title: '정릉천 생태 공간',
    lat: 37.6051,
    lng: 127.0212,
    summary: '자연과 함께하는 마을 산책로',
  },
];

export default function DataMap() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // 클라이언트 사이드에서만 지도 렌더링
  }, []);

  if (!isMounted) {
    return <div className="h-80 text-center pt-6 text-gray-500">지도를 불러오는 중...</div>;
  }

  return (
    <div className="w-full h-80 rounded-xl shadow-md overflow-hidden">
      <MapContainer
        center={[37.6122, 127.0255]} // 길음 중심
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {sampleData.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lng]}>
            <Popup>
              <div className="text-sm font-semibold text-gray-800 mb-1">{point.title}</div>
              <div className="text-xs text-gray-600">{point.summary}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
