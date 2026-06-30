# 씨네시스 - 정적 사이트를 nginx로 띄우는 단일 컨테이너
FROM nginx:alpine

# 메인 페이지 복사 (index.html 안에 배너 이미지가 포함되어 있어 별도 파일은 불필요)
COPY index.html /usr/share/nginx/html/index.html

# 컨테이너 시작 시 환경값으로 config.js 를 만드는 스크립트
COPY docker-entrypoint.d/40-cinesys-config.sh /docker-entrypoint.d/40-cinesys-config.sh
RUN chmod +x /docker-entrypoint.d/40-cinesys-config.sh

EXPOSE 80

# 상태 점검 (사이트가 응답하는지 확인)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
