import { createContext, useContext, useState, useEffect } from 'react';

const RegionContext = createContext();

export function RegionProvider({ children }) {
  const [region, setRegion] = useState('시도(전체)');
  const [district, setDistrict] = useState('시군구(전체)');

  // 최초 실행 시 localStorage 값 반영
  useEffect(() => {
    const savedRegion   = localStorage.getItem('region');
    const savedDistrict = localStorage.getItem('district');
    if (savedRegion) setRegion(savedRegion);
    if (savedDistrict) setDistrict(savedDistrict);
  }, []);

  // region 변경 시 localStorage에도 반영
  useEffect(() => {
    localStorage.setItem('region', region);
  }, [region]);

  useEffect(() => {
    localStorage.setItem('district', district);
  }, [district]);

  return (
    <RegionContext.Provider value={{ region, district, setRegion, setDistrict }}>
      {children}
    </RegionContext.Provider>
  );
}

export const useRegion = () => useContext(RegionContext);
