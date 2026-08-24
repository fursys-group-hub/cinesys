/**
 * 회원 응답 알림 보완 발송 — 직접 호출용
 *
 * 예약 실행(notify-sweep)은 외부에서 호출할 수 없어 동작 확인이 어렵다.
 * 이 함수는 같은 일을 하며, 총무 화면이 열릴 때도 한 번 호출해
 * 예약 실행이 멈춰 있어도 알림이 밀리지 않게 한다.
 *
 * 호출 출처는 ALLOWED_ORIGIN으로 제한된다.
 */
const { sweep } = require('./lib/sweep');

const allowedOrigins = () =>
  (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);

function originMatches(pattern, origin) {
  if (!origin) return false;
  if (pattern === origin) return true;
  if (!pattern.includes('*')) return false;
  const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+') + '$');
  return re.test(origin);
}

function corsHeaders(headers) {
  const origin = (headers.origin || '').trim();
  if (!origin) return {};
  const allowed = allowedOrigins();
  if (allowed.length && !allowed.some(a => originMatches(a, origin))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function originAllowed(headers) {
  const allowed = allowedOrigins();
  if (!allowed.length) return true;
  const origin = headers.origin || '';
  const referer = headers.referer || '';
  return allowed.some(a => originMatches(a, origin) || (!a.includes('*') && referer.startsWith(a)));
}

const json = (statusCode, obj, extra) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...(extra || {}) },
  body: JSON.stringify(obj),
});

exports.handler = async (event) => {
  const cors = corsHeaders(event.headers || {});
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST만 허용됩니다' }, cors);
  if (!originAllowed(event.headers || {})) return json(403, { error: '허용되지 않은 요청 출처입니다' }, cors);

  const out = await sweep();
  return json(out.ok ? 200 : 500, out, cors);
};
