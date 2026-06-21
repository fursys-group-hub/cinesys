# 씨네시스 사이트 프로젝트 폴더

영화 동호회 **씨네시스(CINESYS)** 운영 사이트를 만드는 프로젝트입니다.

## 📁 이 폴더에 뭐가 있나요?

| 파일 | 설명 |
|------|------|
| `cinesis.html` | 지금까지 만든 **작동 프로토타입**. 더블클릭하면 브라우저로 바로 열립니다. 디자인·기능의 기준 원본. |
| `banner.jpg` | 메인 배너 이미지 (CINESYS 일러스트) |
| `CLAUDE.md` | Claude Code에게 프로젝트를 설명하는 문서. 자동으로 읽힙니다. |
| `README.md` | 이 파일. 사용자용 안내. |

## 🚀 시작하는 법

### 1단계: Claude Code 설치 (처음에만)

**Mac:**
1. 터미널 열기 (Spotlight에서 `터미널` 검색)
2. Node.js 설치 → https://nodejs.org 에서 LTS 버전 다운로드 후 설치
3. 터미널에 입력:
   ```
   npm install -g @anthropic-ai/claude-code
   ```

**Windows:**
- 공식 가이드를 따라가는 게 가장 정확해요: https://docs.claude.com/en/docs/claude-code/setup
- WSL(Windows Subsystem for Linux) 위에서 돌리는 게 가장 안정적입니다.

### 2단계: 이 폴더에서 Claude Code 실행

터미널을 열고 이 폴더로 이동:

```
cd "이 폴더 경로"
```

> 폴더 경로 찾는 법:
> - Mac Finder에서 이 폴더 우클릭 → `Option` 누르면서 → "경로 이름 복사"
> - Windows 탐색기에서 주소 표시줄 클릭하면 경로가 나옴

그 다음:

```
claude
```

### 3단계: 첫 메시지

Claude Code가 켜지면 이 메시지를 그대로 보내세요:

```
CLAUDE.md를 먼저 읽고 프로젝트 상황을 파악해줘.
나는 코딩이 처음이니까, 매 단계마다 멈춰서 같이 확인하며 진행하자.
첫 단계로 무엇을 해야 할지 알려줘.
```

이후로는 Claude Code가 단계별로 안내해 줍니다.

## 💡 막힐 때

- 명령어가 작동 안 하면 → 그대로 복사해서 Claude Code에 붙여넣고 물어보기
- 외부 서비스 가입(Supabase, GitHub, Vercel)도 Claude Code가 안내해 줍니다
- 정말 안 풀리면 Claude.ai 채팅창 다시 와서 물어보셔도 돼요

## 🛠️ 진행 흐름 미리보기

1. 프로토타입 동작 확인
2. Supabase(데이터베이스) 가입 + 테이블 만들기
3. 프로토타입 → 정적 사이트 전환 (디자인 그대로, 데이터만 Supabase로)
4. 편집 모드 / 읽기 모드 비밀번호 분기
5. GitHub 저장소 + Vercel 배포
6. 멤버에게 주소 공유 🎉

전부 무료로 진행됩니다.
