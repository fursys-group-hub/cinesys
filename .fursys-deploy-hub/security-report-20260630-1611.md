# 🛡️ 배포 전 검토 결과

보안 점검과 배포 준비 두 가지를 함께 확인했어요. 아래에서 차례대로 보시면 됩니다.

- **보안:** 차단 🔴
- **배포 준비:** 불가 ❌

> ❌ 배포 불가 — 코드에 API 키가 그대로 적혀 있어 보안 검토를 통과하지 못했고, 배포에 꼭 필요한 Dockerfile도 아직 없어요.

- **대상 폴더:** `C:\Users\HP\cinesys`
- **코드 저장소:** fursys-group-hub/cinesys
- **프로젝트 종류:** 정적 HTML 사이트 (Firebase 사용)
- **검사 일시:** 2026-06-30 16:11

**발견 요약:** 치명 3 · 높음 6 · 중간 0 · 낮음 0

---

## 🔒 보안 점검

코드와 기록에서 발견한 보안 문제예요. 치명·높음은 고친 뒤 다시 검토해주세요.

| 심각도 | 위치 | 유형 | 설명 |
|---|---|---|---|
| 치명 | `index.html:586` | 구글(Firebase) API 키 노출 | 실제 운영 파일에 Firebase 접속 키가 코드에 그대로 적혀 있어요. |
| 치명 | `cinesis.html:583` | 구글(Firebase) API 키 노출 | 옛 프로토타입 파일에도 같은 Firebase 키가 들어 있어요. |
| 높음 | `index.html:586` | API 키 추정 값 | 위 Firebase 키가 일반 API 키 형태로도 잡혔어요(같은 위치). |
| 높음 | `cinesis.html:583` | API 키 추정 값 | 옛 프로토타입의 같은 Firebase 키 위치예요. |
| 높음 | `index.html:719` | 비밀 변수에 값 직접 기입 | TMDB(영화 정보) API 키가 코드에 그대로 적혀 있어요. |
| 높음 | `index.html:721` | 비밀 변수에 값 직접 기입 | KOBIS(영화관 입장권) API 키가 코드에 그대로 적혀 있어요. |
| 높음 | `cinesis.html:717` | 비밀 변수에 값 직접 기입 | 옛 프로토타입의 TMDB API 키 위치예요. |
| 높음 | `cinesis.html:719` | 비밀 변수에 값 직접 기입 | 옛 프로토타입의 KOBIS API 키 위치예요. |

### 치명 · Firebase 접속 키가 코드에 노출됨
아래 글을 그대로 복사해 AI 도구에 붙여넣으면 이 문제를 고쳐줍니다.
```
index.html과 cinesis.html에 하드코딩된 firebaseConfig(apiKey 등 Firebase 설정)를 점검해줘.
1) Firebase 웹 apiKey는 브라우저에 공개되는 값이라 키 자체를 숨길 수는 없어. 대신 Firebase 콘솔에서 Realtime Database 보안 규칙(Security Rules)이 "인증된 회원만 읽기/쓰기"로 잠겨 있는지 확인하고, 잠겨 있지 않으면 누구나 DB를 읽고 쓸 수 있으니 즉시 규칙을 설정해줘.
2) 그리고 Firebase 콘솔에서 이 웹 API 키에 HTTP 리퍼러(허용 도메인) 제한을 걸어, 우리 사이트 주소에서만 쓰이도록 제한해줘.
어떤 화면에서 무엇을 눌러야 하는지 단계별로 알려줘.
```
### 높음 · 영화 API 키(TMDB·KOBIS)가 코드에 그대로 있음
아래 글을 그대로 복사해 AI 도구에 붙여넣으면 이 문제를 고쳐줍니다.
```
index.html(과 옛 파일 cinesis.html)에 하드코딩된 TMDB_KEY와 KOBIS_KEY를 점검해줘.
이건 정적 HTML 사이트라 브라우저에서 직접 호출하면 키가 노출될 수밖에 없어. 두 가지 방법 중 하나를 제안하고 적용해줘:
(A) TMDB·KOBIS 발급 콘솔에서 해당 키에 사용 도메인/IP 제한을 걸어 우리 사이트에서만 쓰이게 막는다.
(B) 영화 정보 조회를 서버(또는 작은 프록시)로 옮겨 키를 브라우저에 노출하지 않는다.
지금 구조에서 가장 간단한 방법을 골라 단계별로 안내해줘.
```

---

## 🚀 배포 준비

사내 서버에 올릴 수 있는 상태인지 확인했어요. ✅ 통과 · ❌ 문제 · ➖ 권장입니다.

| 점검 항목 | 결과 | 설명 |
|---|---|---|
| Dockerfile | ❌ | 사내 서버에 올리려면 Dockerfile이 꼭 필요한데 아직 없어요. 정적 사이트라 nginx로 띄우는 Dockerfile을 만들면 돼요. |
| 포트(EXPOSE) 일치 | ➖ | Dockerfile이 없어 확인할 수 없어요. nginx로 만들면 보통 80 포트예요. |
| 시작 방법(CMD) | ❌ | Dockerfile이 없어 앱을 켜는 명령도 아직 없어요. |
| 필수 설정값 누락 | ✅ | 외부에서 꼭 받아야 켜지는 설정값은 없어요(키가 코드 안에 들어 있어요). |
| 상태 점검(HEALTHCHECK) | ➖ | 꼭 필요한 건 아니지만, Dockerfile 만들 때 같이 넣으면 좋아요. |

### 치명 · 배포용 Dockerfile 만들기
아래 글을 그대로 복사해 AI 도구에 붙여넣으면 이 문제를 고쳐줍니다.
```
이 프로젝트는 index.html을 메인으로 하는 정적 HTML 사이트야. 사내 서버(단일 컨테이너)에 올릴 수 있도록 nginx 기반 Dockerfile을 만들어줘.
요구사항:
- 베이스 이미지: nginx:alpine
- index.html과 banner.jpg 같은 정적 파일을 /usr/share/nginx/html 로 복사
- EXPOSE 80
- HEALTHCHECK로 http://localhost/ 응답을 확인
- 배포에 필요 없는 파일(cinesis.html 프로토타입, archive-preview.html, font-preview.html, *.md)은 이미지에 넣지 않기(.dockerignore도 함께 만들기)
완성 후 로컬에서 빌드·실행하는 명령도 알려줘.
```

---

## ⚙️ 설정값 정리

이 앱이 쓰는 설정값과 다루는 방법이에요.

| 설정값 이름 | 다루는 방법 | 설명 |
|---|---|---|
| (별도 설정값 없음) | 코드 안에 직접 적혀 있음 | 이 앱은 Firebase·TMDB·KOBIS 키를 따로 분리하지 않고 코드 안에 적어 두었어요. 위 보안 점검의 키 항목을 참고하세요. |

---

*배포 전 검토 · fursys-deploy-hub · 퍼시스홀딩스 IT본부 AI추진팀*
