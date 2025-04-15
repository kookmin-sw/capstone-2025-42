import os
import io
import pandas as pd
import calendar
import requests
from utils.secrets import load_secret

KMA_API_KEY = load_secret("kma_api_key")

BASE_URL_TEMP = 'https://apihub.kma.go.kr/api/typ01/url/sts_ta.php?'  # 기온
BASE_URL_RAIN = 'https://apihub.kma.go.kr/api/typ01/url/sts_rn.php?'  # 강수
BASE_URL_SNOW = 'https://apihub.kma.go.kr/api/typ01/url/sts_sd.php?'  # 적설


# 해당 년월의 마지막 날(28, 30, 31)
def last_day_of_month(year, month):
    return calendar.monthrange(year, month)[1]


def fetch_weather_df(year, month):
    start_date = f"{year}{month:02d}01"
    end_date = f"{year}{month:02d}{last_day_of_month(year, month)}"

    stn_id = 414  # 국민대학교
    disp, help = 1, 0
    authKey = KMA_API_KEY

    def fetch_df(url, headers):
        response = requests.get(url)
        response.raise_for_status()

        if not response.text.strip():  # ⚠️ 빈 응답 체크
            print(f"⚠️ Empty response from: {url}")
            return pd.DataFrame(columns=headers)

        df = pd.read_csv(io.StringIO(response.text), sep='\s+', names=headers, skiprows=1, dtype=str)

        if df.empty or len(df.columns) != len(headers):
            print(f"⚠️ Malformed or empty data from: {url}")
            return pd.DataFrame(columns=headers)

        df[df.columns[-1]] = df[df.columns[-1]].astype(str).str.rstrip("=")
        return df

    # 기온 데이터
    df_temp = fetch_df(
        f"{BASE_URL_TEMP}&tm1={start_date}&tm2={end_date}&stn_id={stn_id}&disp={disp}&help={help}&authKey={authKey}",
        ['YMD', 'STN_ID', 'LAT', 'LON', 'ALTD',
         'TA_DAVG', 'TMX_DD', 'TMX_OCUR_TMA',
         'TMN_DD', 'TMN_OCUR_TMA', 'MRNG_TMN', 'MRNG_TMN_OCUR_TMA',
         'DYTM_TMX', 'DYTM_TMX_OCUR_TMA', 'NGHT_TMN', 'NGHT_TMN_OCUR_TMA']
    )

    # 강수량 데이터
    df_rain = fetch_df(
        f"{BASE_URL_RAIN}&tm1={start_date}&tm2={end_date}&stn_id={stn_id}&disp={disp}&help={help}&authKey={authKey}",
        ['YMD', 'STN_ID', 'LAT', 'LON', 'ALTD',
         'RN_DSUM', 'RN_MAX_1HR', 'RN_MAX_1HR_OCUR_TMA',
         'RN_MAX_6HR', 'RN_MAX_6HR_OCUR_TMA', 'RN_MAX_10M', 'RN_MAX_10M_OCUR_TMA']
    )

    # 적설량 데이터
    df_snow = fetch_df(
        f"{BASE_URL_SNOW}&tm1={start_date}&tm2={end_date}&stn_id={stn_id}&disp={disp}&help={help}&authKey={authKey}",
        ['TMA', 'STN_ID', 'LAT', 'LON', 'ALTD',
         'FSD_DMAX', 'FSD_DMAX_OCUR_TMA', 'SD_DMAX', 'SD_DMAX_OCUR_TMA']
    )

    return df_temp, df_rain, df_snow

