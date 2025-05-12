![Project Banner](https://github.com/user-attachments/assets/947814c8-2c21-4ed9-97c2-7c9a2d25a2c8)

---

### 1. 프로젝트 소개

본 프로젝트는 **읍·면·동 단위**의 다양한 데이터를 체계적으로 수집·정제하는 **데이터 파이프라인**을 구축하는 것을 목표로 합니다.<br>
이를 통해 사용자들은 세밀한 지역 단위의 데이터를 **검색·다운로드·분석**할 수 있습니다.

### 2. 프로젝트 추진 배경 및 필요성

기존 공공데이터는 주로 **시·군·구 이상 행정구역**에 집중되어 있어 읍·면·동 수준 데이터가 현저히 부족합니다.<br>
읍·면·동 공무원·연구자·사회적 기업 등은 지역 상황을 파악하기 어려워 **정책·서비스 기획**에 높은 장벽을 겪습니다.<br>
본 프로젝트는 주민·대학생 참여를 통해 읍·면·동 데이터를 수집하고, **전처리·저장·배포**하여 공공·민간 부문의 **데이터 기반 의사결정**을 지원합니다.

### 3. 팀 소개

|  이름 |    학번    | 역할                                 |
| :-: | :------: | :--------------------------------- |
| 이종엽 | 20191647 | 팀장 · 양적데이터 전처리 · **PostgreSQL** 설계 |
| 이정혁 | 20203120 | **프론트엔드** · 문서 작업 · 텍스트 전처리        |
| 이지인 | 20181678 | **프론트엔드** · 이미지 전처리                |
| 최유순 | 20190346 | **백엔드** · 인프라 · 동영상 전처리            |

### 4. 사용법

1. **회원가입 & 로그인**
2. 업로드 페이지에서 파일과 설명(메타데이터) 입력 → `업로드` 클릭
3. 검색창에 키워드 입력 후 `검색` → 결과 파일 다운로드

> 업로드 시 설명을 바탕으로 **태그 생성 버튼을 눌러 태그를 생성할수**있습니다. 필요하면 추가·삭제하여 업로드하세요.

### 5. 빌드 방법 (로컬 Docker)

```bash
cd mlops
docker-compose up -d --build
```

1. `http://localhost:8792` → 웹 UI 접속 (업로드/검색)
2. `http://localhost:8080` → **Airflow** UI 접속 → 모든 DAG 정상 등록 확인
3. **첫 실행 전** `mlops/secrets/` 디렉터리에 11개 키 파일을 생성해야 합니다.

### 6. `secrets/` 폴더 구성

각 파일은 **한 줄**(공백·줄바꿈 제외)로 값을 적어 주세요. 예시 경로: `mlops/secrets/<파일명>`

| 파일명                       | 설명                                              | 예시 / 값 형식                                      |
| ------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| **airflow\_fernet\_key**  | Airflow 메타 DB 암호화용 **Fernet 32‑byte 키**         | `hGDqg5T3uxEag2Jd3fDx7qzIY_rMTqTX6j1w2v7EWbs=` |
| **airflow\_password**     | Airflow UI **admin 비밀번호**                       | `S3cureP@ssw0rd!`                              |
| **airflow\_user**         | Airflow UI **admin 아이디**                        | `admin`                                        |
| **jwt\_secret\_key**      | 백엔드 JWT 토큰 서명용 **비밀 키**                         | `supersecretjwtkey123!`                        |
| **kma\_api\_key**         | **기상청(KMA) OpenAPI** 접근 토큰                      | `12345678-aaaa-bbbb-cccc-1234567890ab`         |
| **minio\_root\_user**     | MinIO **root 사용자명**                             | `minioadmin`                                   |
| **minio\_root\_password** | MinIO **root 비밀번호**                             | `MinioS3cur3P@ss`                              |
| **postgresql\_host**      | PostgreSQL 컨테이너 **호스트명**(docker‑compose 서비스 이름) | `postgres`                                     |
| **postgresql\_user**      | PostgreSQL **DB 사용자명**                          | `airflow`                                      |
| **postgresql\_password**  | PostgreSQL **DB 비밀번호**                          | `pgS3cret!`                                    |
| **postgresql\_database**  | Airflow 및 프로젝트 테이블이 저장될 **DB 이름**               | `airflow`                                      |

> #### airflow fernet Key 생성 방법
>
> ```python
> from cryptography.fernet import Fernet
> print(Fernet.generate_key().decode())
> ```

> #### jwt secret Key 생성 방법
>
> ```python
> import secrets
> jwt_secret_key = secrets.token_urlsafe(64)
> print(jwt_secret_key)
> ```
