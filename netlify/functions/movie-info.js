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

async function refreshItems(items) {
  const tmdbKey = process.env.TMDB_KEY;
  const kobisKey = process.env.KOBIS_KEY;
  const today = new Date();

  // 평점은 가벼우니 한꺼번에
  const ratings = await Promise.all(items.map(it =>
    (tmdbKey && it.tmdbId) ? tmdbRating(tmdbKey, it.tmdbId).catch(() => null) : Promise.resolve(null)
  ));

  const results = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const out = { id: it.id };
    if (ratings[i] != null) out.rating = ratings[i];

    if (kobisKey) {
      try {
        const openDate = parseOpenDt(it.kobisOpenDt);
        if (it.kobisMovieCd && openDate) {
          const days = Math.floor((today - openDate) / 86400000);
          // 상영이 끝나고 값이 이미 있으면 더 오르지 않으므로 조회하지 않는다
          if (!(days > FINAL_AFTER_DAYS && Number(it.audienceCount) > 0)) {
            const acc = await weeklyAcc(kobisKey, it.kobisMovieCd, openDate);
            if (acc != null) out.audienceCount = acc;
          }
        } else if (it.title) {
          const r = await resolveAudience(kobisKey, it.title, it.year);
          if (r) {
            out.kobisMovieCd = r.movieCd;
            out.kobisOpenDt = r.openDt;
            if (r.audiAcc != null) out.audienceCount = r.audiAcc;
          }
        }
      } catch (e) {
        out.error = e.message;
      }
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
    const d = await getJson(`${TMDB}/search/movie?api_key=${key}&query=${encodeURIComponent(q)}&language=ko-KR`);
    if (!d) return json(502, { error: 'TMDB 조회에 실패했습니다 — 키를 확인해주세요' });
    return json(200, { results: d.results || [] });
  }

  if (body.audience && typeof body.audience === 'object') {
    const key = process.env.KOBIS_KEY;
    if (!key) return json(503, { error: 'KOBIS_KEY 환경변수가 설정되지 않았습니다' });
    const { title, year } = body.audience;
    return json(200, { audience: await resolveAudience(key, String(title || ''), year) });
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
