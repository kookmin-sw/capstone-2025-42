import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 마커 아이콘 경로를 Vite 환경에 맞게 지정
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// 샘플 데이터
const sampleData = [
  { id: 1, title: '의정부 전통시장', lat: 37.738, lng: 127.047, summary: '지역 경제 중심지' },
  { id: 2, title: '양주 문화센터', lat: 37.798, lng: 127.045, summary: '주민 문화 공간' },
  { id: 3, title: '포천 시립도서관', lat: 37.896, lng: 127.201, summary: '지식 나눔의 중심' },
];

export default function DataMap() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // 클라이언트 사이드에서만 지도 렌더링
  }, []);

  if (!isMounted) {
    return <div className="h-64 text-center pt-6 text-gray-500">지도를 불러오는 중...</div>;
  }

  return (
    <div className="w-full h-64 rounded-lg overflow-hidden">
      <MapContainer
        center={[37.75, 127.05]}
        zoom={10}
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
              <strong>{point.title}</strong><br />
              {point.summary}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
