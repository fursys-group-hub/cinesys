/**
 * 슬랙 알림 중계 함수
 *
 * 두 가지 방식을 처리한다.
 *   1) 채널 알림  { text }                        → Incoming Webhook 으로 채널에 게시
 *   2) 개인 DM    { messages: [{email, text}] }   → 봇 토큰으로 회원 각자에게 DM
 *
 * 토큰·웹훅 주소를 브라우저에 두지 않으려고 만든 함수다. 앱은 내용만 보내고
 * 실제 슬랙 호출은 여기서 일어난다.
 *
 * 환경변수 (Netlify → Site configuration → Environment variables)
 *   SLACK_WEBHOOK_URL     채널 알림용 Incoming Webhook 주소
 *   SLACK_BOT_TOKEN       DM 발송용 봇 토큰 (xoxb-...)
 *                         필요 권한: chat:write, users:read, users:read.email
 *   ALLOWED_EMAIL_DOMAIN  (권장) DM 허용 도메인. 예: fursys.com
 *                         지정하지 않으면 모든 도메인 허용 → 외부인이 이 함수로
 *                         아무에게나 DM을 보낼 수 있으니 되도록 지정할 것
 *   ALLOWED_ORIGIN        (권장) 호출 허용 주소. 쉼표로 여러 개.
 *                         예: https://cinesys.netlify.app,http://localhost:3000
 */
const SLACK_API = 'https://slack.com/api';
const MAX_LEN = 3000;      // 슬랙 메시지 길이 상한
const MAX_RECIPIENTS = 30; // 한 번에 보낼 수 있는 인원

const json = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(obj),
});

const allowedOrigins = () =>
  (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);

// 이 함수는 인터넷에 열려 있으므로, 호출 출처를 확인해 오용을 조금이라도 줄인다.
// (완전한 방어는 아니다 — 제대로 막으려면 앱에 로그인 기능이 있어야 한다)
function originAllowed(headers) {
  const allowed = allowedOrigins();
  if (!allowed.length) return true; // 미설정 시 통과
  const origin = headers.origin || '';
  const referer = headers.referer || '';
  return allowed.some(a => origin === a || referer.startsWith(a));
}

// 앱이 다른 도메인(회사 허브 등)에서 서비스될 때를 위한 교차 출처 허용.
// 허용 목록에 있는 출처에만 헤더를 내려준다.
function corsHeaders(headers) {
  const origin = (headers.origin || '').trim();
  if (!origin) return {};
  const allowed = allowedOrigins();
  if (allowed.length && !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function clip(text) {
  const t = String(text || '').trim();
  return t.length > MAX_LEN ? t.slice(0, MAX_LEN) + '…' : t;
}

async function slackApi(token, path, init) {
  const res = await fetch(`${SLACK_API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init && init.headers) },
  });
  return { data: await res.json().catch(() => ({ ok: false, error: 'invalid_response' })), retryAfter: Number(res.headers.get('retry-after')) || 0 };
}

const errorKo = (code) => ({
  users_not_found: '이 이메일로 슬랙 계정을 찾을 수 없습니다',
  invalid_auth: '봇 토큰이 유효하지 않습니다',
  not_authed: '봇 토큰이 설정되지 않았습니다',
  missing_scope: '봇 권한(scope)이 부족합니다 — chat:write, users:read, users:read.email 확인',
  account_inactive: '비활성 계정입니다',
  ratelimited: '슬랙 요청 제한에 걸렸습니다 — 잠시 후 다시 시도해주세요',
}[code] || code);

async function sendDM(token, email, text) {
  const look = await slackApi(token, `users.lookupByEmail?email=${encodeURIComponent(email)}`, { method: 'GET' });
  if (!look.data.ok) return { ok: false, error: errorKo(look.data.error) };

  const body = JSON.stringify({ channel: look.data.user.id, text });
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body };

  let post = await slackApi(token, 'chat.postMessage', opts);
  if (!post.data.ok && post.data.error === 'ratelimited') {
    await new Promise(r => setTimeout(r, Math.min(post.retryAfter || 1, 5) * 1000));
    post = await slackApi(token, 'chat.postMessage', opts);
  }
  return post.data.ok ? { ok: true } : { ok: false, error: errorKo(post.data.error) };
}

async function postToChannel(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return json(503, { error: 'SLACK_WEBHOOK_URL 환경변수가 설정되지 않았습니다' });
  if (!url.startsWith('https://hooks.slack.com/')) return json(500, { error: 'SLACK_WEBHOOK_URL 값이 슬랙 웹훅 주소가 아닙니다' });
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    const detail = await res.text();
    return res.ok ? json(200, { ok: true }) : json(502, { error: `슬랙 전송 실패 (${res.status}): ${detail}` });
  } catch (e) {
    return json(502, { error: `슬랙 전송 중 오류: ${e.message}` });
  }
}

async function sendDMs(messages) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return json(503, { error: 'SLACK_BOT_TOKEN 환경변수가 설정되지 않았습니다 (DM 발송용 봇 토큰)' });
  if (messages.length > MAX_RECIPIENTS) return json(400, { error: `한 번에 최대 ${MAX_RECIPIENTS}명까지 보낼 수 있습니다` });

  const domain = (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase();
  const results = [];
  for (const m of messages) {
    const email = String((m && m.email) || '').trim().toLowerCase();
    const text = clip(m && m.text);
    if (!email || !email.includes('@')) { results.push({ email, ok: false, error: '이메일이 올바르지 않습니다' }); continue; }
    if (domain && !email.endsWith('@' + domain)) { results.push({ email, ok: false, error: `허용되지 않은 도메인입니다 (${domain}만 가능)` }); continue; }
    if (!text) { results.push({ email, ok: false, error: '보낼 내용이 없습니다' }); continue; }
    try {
      results.push({ email, ...(await sendDM(token, email, text)) });
    } catch (e) {
      results.push({ email, ok: false, error: e.message });
    }
  }
  return json(200, { ok: results.some(r => r.ok), sent: results.filter(r => r.ok).length, results });
}

async function route(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST만 허용됩니다' });
  if (!originAllowed(event.headers || {})) return json(403, { error: '허용되지 않은 요청 출처입니다' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: '요청 형식이 잘못되었습니다' });
  }

  if (Array.isArray(body.messages)) {
    if (!body.messages.length) return json(400, { error: '보낼 대상이 없습니다' });
    return sendDMs(body.messages);
  }

  const text = clip(body.text);
  if (!text) return json(400, { error: '보낼 내용이 없습니다' });
  return postToChannel(text);
}

exports.handler = async (event) => {
  const cors = corsHeaders(event.headers || {});
  const withCors = (r) => ({ ...r, headers: { ...(r.headers || {}), ...cors } });

  // 브라우저가 교차 출처 요청 전에 보내는 사전 확인(preflight)
  if (event.httpMethod === 'OPTIONS') return withCors({ statusCode: 204, body: '' });

  return withCors(await route(event));
};
