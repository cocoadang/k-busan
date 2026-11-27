# Apt와 K-Housing 통합 검증

Apt의 `/market/`에서 K-Housing의 지도, 가격 분석, 단지 비교, 정비사업 분석을 제공한다. 예산 검색과 실거래 이력도 같은 인스턴스의 내부 API를 사용한다. Apt 태그와 운영 서비스 모두 K-Housing의 활성 Firestore 리비전을 읽는다. 평면도는 기존 Apt 저장소를 사용한다.

## 배포 전 검증

1. `bash ops/package-unified-market.sh /path/to/k-housing /path/to/new-build-context`로 깨끗한 빌드 컨텍스트를 만든다. Git 아카이브에서 지도 경계 데이터를 포함하며, K-Housing을 고정된 커밋에서 빌드한다.
2. Apt의 현재 서비스 계정에 K-Housing의 지정 Firestore DB 읽기 권한을 부여한다. 기존 Apt DB 권한도 필요하다. 지도용 키 설정은 `MARKET_GOOGLE_MAPS_API_KEY`, `MARKET_GOOGLE_MAPS_MAP_ID`에 연결한다. 지도 키에 Apt 운영 도메인과 검증 태그 URL의 리퍼러를 등록한다. AI 진단을 운영 중이라면 `MARKET_GEMINI_API_KEY`, `MARKET_GEMINI_MODEL`, 그리고 기존 캐시를 사용하는 경우 `MARKET_AI_CACHE_BUCKET`을 연결한다.
3. Apt의 현재 트래픽을 고정한 상태에서 새 컨테이너를 `market-unified` 태그로 배포한다. 새 컨테이너에 `APT_UNIFIED_HOUSING=true`, `APT_TRADE_MODE=khousing-api`를 설정한다. 이전 리비전 고정용 환경 변수는 제거한다. 기존 서비스 계정, 비밀, 네트워크, 스케줄러, 평면도 저장소 설정을 유지한다.
4. `node ops/verify-unified-market.mjs "$PREVIEW_URL" "$ACTIVE_PRICE_REVISION" "$HISTORY_FIXTURE_MONTH"`로 DB 리비전, 검색 결과, 래미안슈르 59㎡ 거래 이력, 평면도 이미지, 지도 설정, 정비사업 데이터 응답을 확인한다. 브라우저에서 지도 타일, 지역 선택, 가격 차트, 비교, 평면도 확대가 동작하는지 확인한다.

## 운영 전환

1. 검증을 통과한 Apt 리비전으로 트래픽을 전환한다. 같은 검증을 `https://apt.dsoom.com`에서 반복한다.
2. 국토부 자동 갱신의 실행 대상이 Cloud Run Job `khousing-collector`인지 확인한다. 다음 갱신의 새 리비전에서 기존 거래 ID, 취소 건, 공식 출처가 확인된 추가 거래를 대조한다. 집계 숫자와 함께 ID별 차이를 확인한다.
3. 기존 K-Housing 웹 URL을 참조하는 공개 화면과 예약 작업을 점검한다. 참조가 해소되고 데이터 갱신 검증이 통과하면 K-Housing 웹서비스의 공개 접근을 해제한다. 수집 Job, 스케줄러, Firestore, 원본 아카이브는 운영을 계속한다. Apt에서 오류가 발생하면 직전 Apt 리비전의 트래픽을 복구하고 필요한 경우 기존 K-Housing 웹 접근을 복구한다.
