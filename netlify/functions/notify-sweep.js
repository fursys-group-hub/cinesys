/**
 * 회원 응답 알림 보완 발송 (예약 실행)
 *
 * 회원 브라우저가 슬랙으로 바로 보내지 못하는 경우가 있다 — 회사 네트워크가
 * 외부(Netlify) 호출을 막거나, 예전 화면을 쓰거나, 창을 닫아버린 경우다.
 * 회원 응답은 Firebase에 항상 기록되므로, 이 함수가 주기적으로 훑어
 * 아직 슬랙으로 나가지 않은 것을 대신 보낸다.
 *
 * 브라우저가 성공하면 slackSent를 남기므로 중복 발송되지 않는다.
 *
 * 환경변수: SLACK_WEBHOOK_URL (필수), RTDB_URL (선택, 기본값 아래)
 */
const DEFAULT_RTDB = 'https://cinesys-26882-default-rtdb.asia-southeast1.firebasedatabase.app';
const NOTIF_PATH = 'cinesys/cns-notif';
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3일보다 오래된 기록은 건드리지 않는다
const LATE_AFTER_MS = 10 * 60 * 1000;       // 이만큼 지나 보내면 "지연 발송"으로 표시
const MAX_PER_RUN = 10;                     // 한 번에 보낼 최대 건수

const rtdb = () => (process.env.RTDB_URL || DEFAULT_RTDB).replace(/\/$/, '');

function buildText(n, late) {
  const head = `🎬 [씨네시스 ${n.monthId || ''}] ${n.name || '회원'} — ${n.att || ''}`;
  const detail = n.att === '참석 O'
    ? ` · ${n.movie || '-'} ${n.time || ''} · 뒷풀이 ${n.party || ''}`
    : '';
  return head + detail + (late ? '\n(지연 발송된 알림입니다)' : '');
}

async function sweep() {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return { ok: false, error: 'SLACK_WEBHOOK_URL 환경변수가 없습니다' };

  const res = await fetch(`${rtdb()}/${NOTIF_PATH}.json`);
  if (!res.ok) return { ok: false, error: `알림 기록을 읽지 못했습니다 (${res.status})` };
  const all = (await res.json()) || {};

  const now = Date.now();
  const pending = Object.entries(all)
    .filter(([, n]) => n && !n.slackSent)
    .filter(([, n]) => typeof n.ts === 'number' && now - n.ts < MAX_AGE_MS)
    .sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0))
    .slice(0, MAX_PER_RUN);

  if (!pending.length) return { ok: true, sent: 0, checked: Object.keys(all).length };

  const results = [];
  for (const [key, n] of pending) {
    const late = now - n.ts > LATE_AFTER_MS;
    try {
      const r = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: buildText(n, late) }),
      });
      if (!r.ok) {
        results.push({ key, ok: false, error: `슬랙 ${r.status}` });
        continue;
      }
      // 보냈다고 표시하고 실패 기록은 지운다 → 🔔 목록의 "슬랙 미발송" 배지도 사라진다
      await fetch(`${rtdb()}/${NOTIF_PATH}/${key}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackSent: true, slackError: null }),
      });
      results.push({ key, ok: true, name: n.name, late });
    } catch (e) {
      results.push({ key, ok: false, error: e.message });
    }
  }

  return { ok: true, sent: results.filter(r => r.ok).length, results };
}

exports.handler = async () => {
  const out = await sweep();
  return {
    statusCode: out.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(out),
  };
};
