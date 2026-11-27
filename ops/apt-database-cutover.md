# K-Housing 데이터를 Apt Firestore로 이관

1. 이전 운영 프로젝트를 관리하는 Cloud Shell에서 `python3 ops/migrate-khousing-db.py`를 실행한다. 원본과 기존 Apt 운영 설정을 조회한다.
2. 충돌이 없다면 `python3 ops/migrate-khousing-db.py --stage`로 원본 아카이브와 Firestore 컬렉션을 검증하며 복제한다. 가격 이관 도중 기존 Apt의 정비사업·평면도 컬렉션과 기존 웹 트래픽은 유지된다.
3. 통합 이미지는 `bash ops/package-unified-market.sh`의 Git 아카이브 결과로 빌드한다. 기존 Apt 서비스를 트래픽이 없는 후보로 배포하면서 `APT_UNIFIED_HOUSING=true`, `APT_TRADE_MODE=khousing-api`, `APT_MARKET_DB=apt`를 설정한다. K-Housing 이전용 핀은 제거한다. [화면 검증](unified-market.md)의 태그 검증을 실행한다.
4. 같은 이미지로 Apt 프로젝트에 독립 수집 작업을 만든다. 이미지의 `node /app/market/dist/collector.cjs`를 실행하고 `GOOGLE_CLOUD_PROJECT=busan-redevelopment`, 기존 Apt의 `FIRESTORE_DATABASE_ID`, `SOURCE_ARCHIVE_BUCKET=busan-redevelopment-khousing-source`를 설정한다. 기존 K-Housing 작업의 국토부 API, 보존 범위, 외부 통신 설정을 대조한다. 첫 검증 실행에는 `COLLECTOR_VALIDATE_ONLY=true`를 사용한다. 원본과 같은 거래 건수와 활성 데이터가 보존됐는지 확인하고 오류 유무를 확인한다.
5. 기존 작업을 잠시 멈추고 실행 중인 수집이 끝났는지 확인한다. 원본 활성 리비전이 바뀌었으면 `--stage --expected-apt-revision <기존 Apt 검증 리비전>`으로 변경분을 대조한 뒤 최종 리비전을 복제한다. Apt 후보를 재검증하고 운영 트래픽을 옮긴다. 새 수집기의 첫 운영 실행 후 활성 리비전과 거래·취소 상태를 대조한 뒤 일정을 전환한다.
6. 구 URL의 종속성을 확인하고 K-Housing 웹서비스 및 중복 수집 일정을 종료한다. 원본 DB와 아카이브는 롤백에 사용한다.
