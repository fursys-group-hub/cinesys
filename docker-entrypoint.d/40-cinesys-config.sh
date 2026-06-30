#!/bin/sh
# 컨테이너가 켜질 때 환경값을 읽어 config.js 를 만든다.
# (키는 이미지 안에 들어가지 않고, 배포 환경값으로만 주입된다.)
set -e
cat > /usr/share/nginx/html/config.js <<EOF
window.CINESYS_CONFIG = {
  FIREBASE_API_KEY: "${FIREBASE_API_KEY}",
  TMDB_KEY: "${TMDB_KEY}",
  KOBIS_KEY: "${KOBIS_KEY}"
};
EOF
echo "[cinesys] config.js 생성 완료"
