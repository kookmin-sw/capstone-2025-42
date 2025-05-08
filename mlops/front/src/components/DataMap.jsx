import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 마커 아이콘 직접 지정 (Docker + Vite 환경 호환)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const customIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 길음 & 정릉 기반 샘플 데이터
const sampleData = [
  {
    id: 1,
    title: '정릉 전통시장',
    lat: 37.61119,
    lng: 127.01369,
    summary: '정릉 지역의 오래된 전통시장'
  },
  {
    id: 2,
    title: '길음역 10번 출구',
    lat: 37.60381,
    lng: 127.02459,
    summary: '길음 중심 교통 요지'
  },
  {
    id: 3,
    title: '정릉 청소년 문화의 집',
    lat: 37.61010,
    lng: 127.01651,
    summary: '청소년을 위한 지역 커뮤니티 공간'
  }
];

export default function DataMap() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // 클라이언트 사이드 렌더링
  }, []);

  if (!isMounted) {
    return <div className="h-64 text-center pt-6 text-gray-500">지도를 불러오는 중...</div>;
  }

  return (
    <div className="w-full h-64 rounded-lg overflow-hidden">
      <MapContainer
        center={[37.607, 127.018]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {sampleData.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lng]} icon={customIcon}>
            <Popup>
              <strong>{point.title}</strong><br />
              {point.summary}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

