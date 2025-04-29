# Node.js 이미지를 기반으로 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 소스 코드 복사
COPY . .

# 현재 디렉토리 내용 확인
RUN echo "=== Current directory contents ===" && ls -la

# 빌드 (자세한 로그 출력)
RUN echo "=== Starting build ===" && \
    npm run build && \
    echo "=== Build completed ==="

# 빌드된 파일 확인
RUN echo "=== Checking dist directory ===" && \
    ls -la /app/dist

# nginx 설치
RUN echo "=== Installing nginx ===" && \
    apk add --no-cache nginx

# nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 빌드된 파일을 nginx가 접근할 수 있는 위치로 복사
RUN echo "=== Copying files to nginx directory ===" && \
    mkdir -p /usr/share/nginx/html && \
    cp -r /app/dist/* /usr/share/nginx/html/ && \
    echo "=== Files copied ==="

# 최종 파일 확인
RUN echo "=== Final nginx directory contents ===" && \
    ls -la /usr/share/nginx/html

# 포트 설정
EXPOSE 80

# nginx 실행
CMD ["nginx", "-g", "daemon off;"] 