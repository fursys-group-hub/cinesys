/**
 * 영화 정보 조회 중계 함수 (TMDB 평점 · KOBIS 관객수)
 *
 * API 키를 브라우저에 두지 않으려고 만든 함수다. 앱은 조회할 항목만 보내고
 * 실제 호출은 여기서 일어난다.
 *
 * 요청 형태
 *   { search: "제목" }                      → TMDB 제목 검색
 *   { audience: { title, year } }            → KOBIS에서 영화코드·개봉일·누적관객수 찾기
 *   { items: [ {...라이브러리 항목} ] }      → 평점·관객수 일괄 갱신
 *
 * 환경변수: TMDB_KEY, KOBIS_KEY
 *          ALLOWED_ORIGIN (권장, 쉼표로 여러 개)
 */
const TMDB = 'https://api.themoviedb.org/3';
const KOBIS = 'https://www.kobis.or.kr/kobisopenapi/webservice/rest';
const MAX_WEEKS = 14;      // 개봉 후 몇 주까지 주간 순위를 뒤져볼지
const MAX_WEEK_FETCH = 20; // 한 번에 받아올 주간 순위표 수 (실행 시간 상한)
const FINAL_AFTER_DAYS = 150; // 이 기간이 지나고 관객수가 있으면 확정된 값으로 보고 조회 생략
const MAX_ITEMS = 60;

const json = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(obj),
});

const allowedOrigins = () =>
  (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);

function originAllowed(headers) {
  const allowed = allowedOrigins();
  if (!allowed.length) return true;
  const origin = headers.origin || '';
  const referer = headers.referer || '';
  return allowed.some(a => origin === a || referer.startsWith(a));
}

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

const getJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json().catch(() => null);
};

/* 조회가 실패했을 때 원인을 알 수 있게 응답을 그대로 살펴본다.
   TMDB는 status_message, KOBIS는 faultInfo.message로 사유를 알려준다. */
async function probe(url) {
  try {
    const r = await fetch(url);
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    const raw = text.slice(0, 200);
    if (data && data.faultInfo) return { ok: false, raw, reason: `KOBIS: ${data.faultInfo.message || ''} (${data.faultInfo.errorCode || ''})` };
    if (!r.ok) return { ok: false, raw, reason: `TMDB ${r.status}: ${(data && data.status_message) || text.slice(0, 120)}` };
    return { ok: true, data, raw };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
// 진단용 — 키는 가린다
const maskKey = (u) => String(u).replace(/key=[^&]*/, 'key=***');

const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const parseOpenDt = (s) => {
  if (!s || String(s).length < 8) return null;
  const t = String(s);
  const d = new Date(Number(t.slice(0, 4)), Number(t.slice(4, 6)) - 1, Number(t.slice(6, 8)));
  return isNaN(d) ? null : d;
};

/* 주간 박스오피스에서 누적관객수를 찾는다.
   개봉 후 가능한 주차를 한꺼번에 조회하고, 값이 있는 가장 최근 주차를 쓴다.
   (한 주씩 순서대로 기다리면 최대 14번을 직렬로 호출해 시간이 초과된다) */
async function weeklyAcc(key, movieCd, openDate) {
  const today = new Date();
  const weeks = [];
  for (let w = 1; w <= MAX_WEEKS; w++) {
    const d = new Date(openDate);
    d.setDate(d.getDate() + w * 7);
    if (d > today) break;      // 아직 오지 않은 주차
    weeks.push({ w, dt: ymd(d) });
  }
  if (!weeks.length) return null;

  const found = await Promise.all(weeks.map(async ({ w, dt }) => {
    const data = await getJson(`${KOBIS}/boxoffice/searchWeeklyBoxOfficeList.json?key=${key}&targetDt=${dt}&itemPerPage=50`)
      .catch(() => null);
    const list = (data && data.boxOfficeResult && data.boxOfficeResult.weeklyBoxOfficeList) || [];
    const hit = list.find(m => m.movieCd === movieCd);
    return hit && hit.audiAcc != null ? { w, acc: Number(hit.audiAcc) } : null;
  }));

  // 순위에 남아 있던 가장 최근 주차의 누적값이 가장 정확하다
  const hits = found.filter(Boolean).sort((a, b) => b.w - a.w);
  return hits.length ? hits[0].acc : null;
}

// 제목·연도로 KOBIS 영화코드와 개봉일을 찾고 누적관객수까지 조회
async function resolveAudience(key, title, year) {
  if (!title) return null;
  const yr = year ? String(year) : '';
  const url = `${KOBIS}/movie/searchMovieList.json?key=${key}&movieNm=${encodeURIComponent(title)}`
    + `&openStartDt=${yr}&openEndDt=${yr ? String(Number(yr) + 1) : ''}&itemPerPage=5`;
  const data = await getJson(url);
  const list = (data && data.movieListResult && data.movieListResult.movieList) || [];
  if (!list.length) return null;
  const { movieCd, openDt } = list[0];
  const openDate = parseOpenDt(openDt);
  if (!movieCd || !openDate) return null;
  return { movieCd, openDt, audiAcc: await weeklyAcc(key, movieCd, openDate) };
}

async function tmdbRating(key, tmdbId) {
  const d = await getJson(`${TMDB}/movie/${tmdbId}?api_key=${key}&language=ko-KR`);
  return d && d.vote_average != null ? d.vote_average : null;
}

// 주간 순위표는 그 주의 모든 영화를 담고 있다. 주차별로 한 번만 받아
// 라이브러리 전체를 대조하면 요청 수가 영화 편수와 무관해진다.
const mondayOf = (d) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

async function audienceByCode(key, items) {
  const today = new Date();
  const need = [];
  const weekSet = new Set();

  items.forEach(it => {
    const openDate = parseOpenDt(it.kobisOpenDt);
    if (!it.kobisMovieCd || !openDate) return;
    const days = Math.floor((today - openDate) / 86400000);
    // 상영이 끝나고 값이 이미 있으면 더 오르지 않으므로 조회하지 않는다
    if (days > FINAL_AFTER_DAYS && Number(it.audienceCount) > 0) return;

    const weeks = [];
    for (let w = 1; w <= MAX_WEEKS; w++) {
      const d = new Date(openDate);
      d.setDate(d.getDate() + w * 7);
      if (d > today) break;
      weeks.push(ymd(mondayOf(d)));   // 같은 주는 같은 순위표
    }
    if (!weeks.length) return;
    const uniq = [...new Set(weeks)].reverse();  // 최근 주 우선
    uniq.forEach(w => weekSet.add(w));
    need.push({ id: it.id, movieCd: it.kobisMovieCd, weeks: uniq });
  });

  const found = new Map();
  if (!need.length) return found;

  const targets = [...weekSet].sort().reverse().slice(0, MAX_WEEK_FETCH);
  const lists = new Map();
  await Promise.all(targets.map(async dt => {
    const data = await getJson(`${KOBIS}/boxoffice/searchWeeklyBoxOfficeList.json?key=${key}&targetDt=${dt}&itemPerPage=50`)
      .catch(() => null);
    lists.set(dt, (data && data.boxOfficeResult && data.boxOfficeResult.weeklyBoxOfficeList) || []);
  }));

  need.forEach(({ id, movieCd, weeks }) => {
    for (const w of weeks) {                 // 순위에 남아 있던 가장 최근 주차
      const list = lists.get(w);
      if (!list) continue;
      const hit = list.find(m => m.movieCd === movieCd);
      if (hit && hit.audiAcc != null) { found.set(id, Number(hit.audiAcc)); break; }
    }
  });
  return found;
}

async function refreshItems(items) {
  const tmdbKey = process.env.TMDB_KEY;
  const kobisKey = process.env.KOBIS_KEY;

  // 평점(편당 1회)과 관객수(주차별 공용)를 동시에 진행
  const [ratings, byCode] = await Promise.all([
    Promise.all(items.map(it =>
      (tmdbKey && it.tmdbId) ? tmdbRating(tmdbKey, it.tmdbId).catch(() => null) : Promise.resolve(null)
    )),
    kobisKey ? audienceByCode(kobisKey, items).catch(() => new Map()) : Promise.resolve(new Map()),
  ]);

  // KOBIS 코드가 없는 항목만 제목으로 따로 찾는다 (보통 없거나 한두 건)
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const out = { id: it.id };
    if (ratings[i] != null) out.rating = ratings[i];
    if (byCode.has(it.id)) out.audienceCount = byCode.get(it.id);

    if (kobisKey && !it.kobisMovieCd && it.title) {
      try {
        const r = await resolveAudience(kobisKey, it.title, it.year);
        if (r) {
          out.kobisMovieCd = r.movieCd;
          out.kobisOpenDt = r.openDt;
          if (r.audiAcc != null) out.audienceCount = r.audiAcc;
        }
      } catch (e) { out.error = e.message; }
    }
    results.push(out);
  }
  return results;
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

  if (typeof body.search === 'string') {
    const key = process.env.TMDB_KEY;
    if (!key) return json(503, { error: 'TMDB_KEY 환경변수가 설정되지 않았습니다' });
    const q = body.search.trim();
    if (!q) return json(400, { error: '검색어가 없습니다' });
    const p = await probe(`${TMDB}/search/movie?api_key=${key}&query=${encodeURIComponent(q)}&language=ko-KR`);
    if (!p.ok) return json(502, { error: `TMDB 조회 실패 — ${p.reason}` });
    return json(200, { results: (p.data && p.data.results) || [] });
  }

  if (body.audience && typeof body.audience === 'object') {
    const key = process.env.KOBIS_KEY;
    if (!key) return json(503, { error: 'KOBIS_KEY 환경변수가 설정되지 않았습니다' });
    const { title, year } = body.audience;
    const yr = year ? String(year) : '';
    // 키 문제인지 검색 결과가 없는 것인지 구분해서 알려준다
    const searchUrl = `${KOBIS}/movie/searchMovieList.json?key=${key}&movieNm=${encodeURIComponent(String(title || ''))}`
      + `&openStartDt=${yr}&openEndDt=${yr ? String(Number(yr) + 1) : ''}&itemPerPage=5`;
    const p = await probe(searchUrl);
    if (!p.ok) return json(502, { error: `KOBIS 조회 실패 — ${p.reason}` });
    const found = await resolveAudience(key, String(title || ''), year);
    if (found) return json(200, { audience: found });
    // 결과가 없으면 왜 없는지 알 수 있게 KOBIS가 돌려준 내용을 함께 전달.
    // 제목 검색은 키가 틀려도 0건으로만 응답하므로, 오류를 알려주는
    // 주간 박스오피스로 키 자체를 따로 확인한다.
    const lst = (p.data && p.data.movieListResult) || {};
    const lastWeek = new Date(Date.now() - 8 * 86400000);
    const kp = await probe(`${KOBIS}/boxoffice/searchWeeklyBoxOfficeList.json?key=${key}&targetDt=${ymd(lastWeek)}&itemPerPage=10`);
    return json(200, {
      audience: null,
      키확인: kp.ok ? '정상' : kp.reason,
      detail: `KOBIS 제목 검색 결과 ${lst.totCnt != null ? lst.totCnt + '건' : '알 수 없음'}`,
      candidates: (lst.movieList || []).slice(0, 5).map(m => ({ movieNm: m.movieNm, movieCd: m.movieCd, openDt: m.openDt })),
    });
  }

  if (Array.isArray(body.items)) {
    if (!body.items.length) return json(200, { results: [] });
    if (body.items.length > MAX_ITEMS) return json(400, { error: `한 번에 최대 ${MAX_ITEMS}편까지 조회할 수 있습니다` });
    if (!process.env.TMDB_KEY && !process.env.KOBIS_KEY) {
      return json(503, { error: 'TMDB_KEY·KOBIS_KEY 환경변수가 설정되지 않았습니다' });
    }
    return json(200, { results: await refreshItems(body.items) });
  }

  return json(400, { error: '요청 내용을 알 수 없습니다' });
}

exports.handler = async (event) => {
  const cors = corsHeaders(event.headers || {});
  const withCors = (r) => ({ ...r, headers: { ...(r.headers || {}), ...cors } });
  if (event.httpMethod === 'OPTIONS') return withCors({ statusCode: 204, body: '' });
  return withCors(await route(event));
};
