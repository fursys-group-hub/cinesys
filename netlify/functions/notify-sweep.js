/**
 * 회원 응답 알림 보완 발송 — 예약 실행 (netlify.toml의 schedule)
 *
 * 실제 로직은 lib/sweep.js에 있다. 같은 로직을 손으로도 돌릴 수 있게
 * notify-sweep-run.js가 HTTP로 노출한다 (예약 함수는 외부 호출이 막혀 있음).
 */
const { sweep } = require('./lib/sweep');

exports.handler = async () => {
  const out = await sweep();
  console.log('notify-sweep', JSON.stringify(out));
  return {
    statusCode: out.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(out),
  };
};
