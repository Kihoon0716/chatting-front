# 채팅 애플리케이션

실시간 채팅 기능을 제공하는 웹 애플리케이션입니다.

## 기술 스택

- Frontend: React, TypeScript, Vite
- Backend: FastAPI (포트 8002)
- WebSocket: WebSocket API

## 도커 실행 방법

### 1. 도커 이미지 빌드

```bash
# 단일 이미지 빌드
docker build -t chatting-frontend .

# 또는 docker-compose를 사용한 빌드
docker-compose build
```

### 2. 도커 컨테이너 실행

```bash
# 단일 컨테이너 실행
docker run -p 5173:5173 chatting-frontend

# 또는 docker-compose를 사용한 실행
docker-compose up

# 백그라운드에서 실행
docker-compose up -d
```

### 3. 도커 컨테이너 중지

```bash
# 단일 컨테이너 중지
docker stop <container_id>

# 또는 docker-compose를 사용한 중지
docker-compose down
```

### 4. 도커 컨테이너 로그 확인

```bash
# 단일 컨테이너 로그
docker logs <container_id>

# 또는 docker-compose를 사용한 로그 확인
docker-compose logs -f
```

### 5. 도커 컨테이너 상태 확인

```bash
# 실행 중인 컨테이너 목록
docker ps

# 모든 컨테이너 목록
docker ps -a
```

## 접속 방법

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:8002

## 주요 기능

- 실시간 채팅
- 채팅방 생성 및 관리
- 친구 추가 및 관리
- 메시지 삭제 기능
- 시스템 메시지 표시

## 개발 환경 설정

1. Node.js 18 이상 설치
2. 프로젝트 클론
3. 의존성 설치: `npm install`
4. 개발 서버 실행: `npm run dev`

## 빌드 및 배포

1. 프로덕션 빌드: `npm run build`
2. 정적 파일 서빙: `npm run preview`
