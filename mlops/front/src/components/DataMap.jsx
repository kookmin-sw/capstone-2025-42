import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useRegion } from '../contexts/RegionContext';

export default function DataMap() {
  const { region, district } = useRegion();
  const [markerInfo, setMarkerInfo] = useState(null);
  const [center, setCenter] = useState([36.5, 127.5]);

  useEffect(() => {
    const loadData = async () => {
      // ❗ 지역이 선택되지 않았으면 아무 작업 안 함
      if (region === '시도(전체)' || district === '시군구(전체)') {
        setMarkerInfo(null);
        return;
      }

      try {
        const query = `${region} ${district}`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.length > 0) {
          const { lat, lon } = data[0];
          const coords = [parseFloat(lat), parseFloat(lon)];
          setCenter(coords);

          // 로그인 안 해도 되는 공개 API로 요청
          const countRes = await fetch(`/api/upload_count?region=${region}&district=${district}`);
          const countData = await countRes.json();

          setMarkerInfo({
            lat: parseFloat(lat),
            lng: parseFloat(lon),
            title: `${district} 아카이빙`,
            count: countData?.count ?? null,
          });
        }
      } catch (err) {
        console.error('지도 데이터 로딩 실패:', err);
      }
    };

    loadData();
  }, [region, district]);

  // ❗ 지역 미선택 시 아예 렌더링 안 함
  if (region === '시도(전체)' || district === '시군구(전체)') return null;

  return (
    <div className="h-96 rounded-xl overflow-hidden shadow mt-6">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markerInfo && (
          <Marker position={[markerInfo.lat, markerInfo.lng]}>
            <Popup>
              <strong>{markerInfo.title}</strong>
              {markerInfo.count !== null && (
                <>
                  <br />
                  업로드 수: {markerInfo.count}건
                </>
              )}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
