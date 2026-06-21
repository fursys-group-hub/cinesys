# 씨네시스 (CINESYS) Movie Club Site

> **Claude Code는 이 파일을 가장 먼저 읽어주세요.** 프로젝트의 목적, 사용자 상황, 결정된 기술 스택, 작업 순서가 모두 여기 있습니다.

---

## 한 줄 요약
씨네시스 영화 동호회의 매달 활동 · 정산 · 후기 당첨 · 멤버를 관리하는 웹사이트.
**이미 작동하는 단일 파일 프로토타입(`cinesis.html`)이 있고, 이것을 배포형 웹앱으로 발전시키는 것이 목표.**

## 사용자에 대해 (매우 중요)
- 동호회의 **총무 1명**이 사이트를 운영
- **코딩 경험 거의 없음 — 첫 프로젝트**
- 따라서:
  - 모든 단계를 친절하게, 풀어서 설명할 것
  - 명령어는 복사해서 그대로 붙여넣을 수 있도록 줄 것
  - 외부 서비스 가입(Supabase, Vercel, GitHub 등)도 가입 절차부터 안내할 것
  - 결정이 필요한 갈림길에선 추천안을 먼저 제시하고 진행 여부를 묻기
- **한국어로 응답할 것**

---

## 권한 모델 (이 프로젝트의 핵심)
- **총무 1명**: 비밀번호 한 개로 편집 모드 진입 → 모든 데이터 입력·수정·삭제
- **나머지 멤버 (15명 내외)**: 사이트 주소만 열면 됨. 로그인 불필요. **읽기 전용**.
- 멤버별 개인 계정 / 멤버별 비밀번호는 **만들지 않음** (의도적으로 단순화)
- 따라서 Supabase Auth의 풀 사용자 시스템은 불필요. 단일 비밀번호 게이트로 충분.

## 결정된 기술 스택
| 영역 | 선택 | 이유 |
|------|------|------|
| 프론트엔드 | 정적 HTML/CSS/JS (`cinesis.html` 재활용) | 사용자 학습 부담 최소 |
| 데이터 저장 | **Supabase** 무료 티어 | DB + 인증을 한 번에, 무료 한도 넉넉 |
| 호스팅 | **Vercel** 무료 | GitHub 연결만 하면 자동 배포 |
| 버전 관리 | Git + GitHub | Vercel 자동 배포 연동용 |
| 도메인 | Vercel 무료 주소부터 시작 | 나중에 커스텀 도메인 옵션 |

**총 비용 목표: 0원**.

---

## 프로토타입(`cinesis.html`)에 대해
- 한 파일 안에 HTML / CSS / JS / 배너 이미지(base64) 모두 들어 있음 (~350KB)
- 데이터는 `window.storage`(Claude 아티팩트 전용 공유 저장소)를 사용 중. **이걸 Supabase로 교체하는 것이 핵심 작업**
- 멤버 시드 15명, 2026년 5월 활동 시드가 들어 있음 — 실제 데이터로 출발 가능
- **디자인 톤, 폰트, 색상, UI 패턴, 기능은 모두 그대로 살릴 것**

### 디자인 시스템
- **무드**: 에디토리얼 시네마 / 보티크. 따뜻하고 차분함 (강한 색상 X)
- **색**: 크림 베이지 배경 `#f5f1ea`, 차콜 텍스트 `#2c2c2c`, 포인트 세피아 `#b8854f`, 강조 버건디 `#8b3a3a`, 머스타드 골드 `#c4a155`
- **폰트**: 헤더 Noto Serif KR / Playfair Display, 본문 Noto Sans KR, 라벨 Montserrat (대문자 자간)
- **컴포넌트**: 칩 토글(참석/뒷풀이/티켓 등), 통계 카드(큰 숫자), 도트 인디케이터(연속불참), 캐러셀 룰렛

---

## 4개 메뉴 기능 (탭 순서대로)

### 1. 이달의 활동
- 상영작 등록 (영화별 제목·시간, 롯데시네마 예매 링크)
- 멤버 표: 참석/불참 · 관람 영화 선택 · 좌석 · 티켓 전달 · 뒷풀이 참석 · 연속불참(3칸 도트)
- 연속불참 3회 → "자동 탈퇴 대상" 경고 배지 표시 (실제 삭제는 총무가 수동)
- 하단 집계: 총 참석 / 티켓 전달 진행 / 뒷풀이 / 영화별 인원 / 자동 탈퇴 대상

### 2. 후기 당첨
- 영화별 관람자 중 룰렛 추첨
- 영화별 후기 담당자 자동 저장 + 보드 표시

### 3. 정산
- **회사 지원금** (자동): 참석 인원 × 1인당 지원금(기본 30,000원)
- **영화비 지출**: 영화별로 예매 건별 라벨+금액 다중 입력. 합계 자동
- **뒷풀이/간식비 (1차 정산)**: 뒷풀이 참석자 자동 리스트 → 각자 쓴 금액 입력 + 정산 완료 토글. 총무는 본인 면제
- **정산 결과**: 총 지출 vs 지원금 자동 비교. 잔액/초과액 표시 + 안내 콜아웃
- **뒷풀이 참석자 정산 (2차 정산)**: 초과 시에만 활성화. 초과액 ÷ 뒷풀이 인원 = 1인당 정산액. 입금 여부 토글. 총무 본인 자동 면제

### 4. 멤버 관리
- 멤버 추가/수정/삭제
- 필드: 이름, 등급, 소속법인, 소속팀, 가입일자, 탈퇴일자, 타동호회, 은행, 계좌번호
- **등급 3개**: 회장 · 총무 · 회원 (지정 가능, 색상 칩 표시)
- 소속법인: 퍼시스 / 퍼시스홀딩스 / 일룸 / 시디즈 / 기타

### 공통
- 상단에 달 셀렉터 (월별 데이터 누적)
- 새 달 만들기, 이 달 삭제
- 메인 배너 (CINESYS 일러스트 + 슬로건 + 매니페스토)

---

## 데이터 모델 (Supabase 테이블 가이드)

```sql
members (
  id uuid primary key,
  name text not null,
  company text,        -- 퍼시스/퍼시스홀딩스/일룸/시디즈/기타
  team text,
  join_date date,
  leave_date date,
  other_clubs text,
  bank text,
  account text,
  role text not null default '회원',  -- 회장/총무/회원
  created_at timestamptz default now()
)

months (
  id text primary key,                -- 예: "2026-05"
  label text,
  per_person_subsidy integer default 30000,
  created_at timestamptz default now()
)

movies (
  id uuid primary key,
  month_id text references months(id) on delete cascade,
  title text not null,
  time text
)

records (
  id uuid primary key,
  month_id text references months(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  attending boolean default false,
  movie_id uuid references movies(id) on delete set null,
  seat text,
  ticket_given boolean default false,
  afterparty boolean default false,
  unique (month_id, member_id)
)

movie_costs (
  id uuid primary key,
  month_id text references months(id) on delete cascade,
  movie_id uuid references movies(id) on delete cascade,
  label text,
  amount integer not null
)

party_expenses (
  id uuid primary key,
  month_id text references months(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  amount integer default 0,
  reimbursed boolean default false,
  unique (month_id, member_id)
)

excess_payments (
  id uuid primary key,
  month_id text references months(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  deposited boolean default false,
  unique (month_id, member_id)
)

reviewers (
  month_id text references months(id) on delete cascade,
  movie_id uuid references movies(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  primary key (month_id, movie_id)
)
```

### Row Level Security 정책 (요지)
- 모든 테이블 `public read` 허용
- `write/update/delete`는 `auth.role() = 'authenticated'` 세션만 (총무 로그인 상태)
- 또는 Supabase Auth 안 쓰고 Edge Function으로 비밀번호 검증 후 service_role 키로 쓰기 — 둘 중 단순한 쪽 선택 권장

---

## 권장 작업 순서

> 첫 코딩이라 단계마다 멈춰서 동작 확인하며 진행할 것.

1. **프로토타입 동작 확인** — 브라우저로 `cinesis.html` 열어 기능 둘러보기
2. **Supabase 가입 + 프로젝트 생성** — 사용자가 멈춰 있다면 가입 절차도 안내
3. **Supabase 테이블 만들기** — 위 SQL 그대로 SQL Editor에 붙여넣어 실행
4. **프로토타입 → 정적 사이트 전환** — `cinesis.html`을 기반으로 `index.html` 만들고, `window.storage` 호출부를 Supabase 클라이언트로 교체. 디자인/UI는 그대로
5. **편집 모드 / 읽기 모드 분리** — 우상단 자물쇠 버튼 → 비밀번호 입력 모달 → 통과 시 편집 가능, 미통과 시 모든 입력 비활성화
6. **로컬에서 동작 확인** — 같은 폴더의 두 브라우저 탭에서 한 쪽 편집, 다른 쪽 읽기로 동기화 확인
7. **GitHub 저장소 만들기** — 가입/리포 생성 안내
8. **Vercel 연결 + 첫 배포** — 무료 주소 발급, 환경변수에 Supabase 키 등록
9. **멤버에게 주소 공유**

각 단계 끝날 때마다 사용자에게 결과를 보여주고 다음 단계로 갈지 확인.

---

## 작업 규칙
- 디자인 / UI / 데이터 구조를 임의로 바꾸지 말 것. 변경하고 싶으면 먼저 사용자에게 제안하고 확인.
- API 키 등 민감 정보는 `.env` 파일로 분리, `.gitignore`에 추가
- 매 단계 작업 후 "지금 ~를 만들었어요. 동작 확인해 보고 다음으로 갈까요?" 식의 체크인
- 사용자가 막혀 있으면 더 잘게 쪼개서 안내
- 외부 서비스 가입은 화면 캡처 안내까지는 못 해도, 메뉴 경로/버튼명을 정확히 알려줄 것
- 모르는 게 있으면 추측하지 말고 솔직히 말한 뒤 같이 확인

---

## 파일 맵
- `cinesis.html` — 작동 프로토타입 (디자인·기능 기준 원본)
- `banner.jpg` — 메인 배너 이미지 원본 (1800×507)
- `CLAUDE.md` — 이 문서
- `README.md` — 사용자용 폴더 안내

작업이 진행되면서 생길 파일들 (예시):
- `index.html` — 진짜 배포될 메인 페이지
- `js/` — 자바스크립트 모듈
- `css/` — 스타일 (또는 인라인 유지)
- `.env` — Supabase URL/키 (gitignore)
- `.gitignore`
