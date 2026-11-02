import { NextResponse } from 'next/server';
import { frameXJson } from '../../../lib/framex-request.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIONS = new Set([
  'home', 'search', 'genres', 'suggestions', 'recommendations', 'operations',
  'rank-groups', 'detail', 'chapters', 'chapter'
]);
const MAX_LIST_SIZE = 100;
const MAX_CHAPTER_CONTENT = 1_000_000;
const NO_STORE = { 'Cache-Control': 'private, no-store' };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function text(value, max = 500) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

function safeCount(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function safeStringList(value, max = 30) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,|]/) : [];
  return values.map((entry) => text(entry, 100)).filter(Boolean).slice(0, max);
}

function rootData(source) {
  let data = source;
  for (let index = 0; index < 3 && data && !Array.isArray(data) && typeof data === 'object'; index += 1) {
    if (data.data && typeof data.data === 'object') data = data.data;
    else if (data.result && typeof data.result === 'object') data = data.result;
    else if (data.payload && typeof data.payload === 'object') data = data.payload;
    else break;
  }
  return data;
}

function novelRecord(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const novelId = text(source.novelId ?? source.contentId ?? source.id, 128);
  const title = text(source.title ?? source.novelName ?? source.name, 300);
  if (!novelId && !title) return null;
  return {
    novelId,
    title,
    author: text(source.author, 200),
    summary: text(source.summary ?? source.description, 3000),
    genres: safeStringList(source.genres ?? source.genre),
    tags: safeStringList(source.tags),
    score: Number.isFinite(Number(source.score)) ? Number(source.score) : null,
    novelStatus: text(source.novelStatus, 80),
    novelStatusDesc: text(source.novelStatusDesc, 160),
    totalChapters: safeCount(source.totalChapters),
    totalViews: safeCount(source.totalViews),
    totalWords: safeCount(source.totalWords),
    totalWordsFormat: text(source.totalWordsFormat, 80)
  };
}

function findList(value, depth = 0) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object' || depth > 4) return [];
  for (const key of ['items', 'novels', 'genres', 'records', 'list', 'results', 'recommendations', 'suggestions', 'data']) {
    if (Array.isArray(value[key])) return value[key];
  }
  for (const key of ['data', 'result', 'payload']) {
    if (value[key] && typeof value[key] === 'object') {
      const found = findList(value[key], depth + 1);
      if (found.length) return found;
    }
  }
  return [];
}

function normalizedNovels(source, limit = MAX_LIST_SIZE) {
  return findList(rootData(source)).map(novelRecord).filter(Boolean).slice(0, limit);
}

function genreRecords(source) {
  const data = rootData(source);
  const values = Array.isArray(data) ? data : findList(data);
  return values.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') {
      const name = text(item, 100);
      return name ? { name } : null;
    }
    if (!item || typeof item !== 'object') return null;
    const name = text(item.name ?? item.genreName ?? item.label ?? item.title, 100);
    const genreId = text(item.genreId ?? item.id ?? item.value, 128);
    return name ? { genreId, name, count: safeCount(item.count ?? item.total) } : null;
  }).filter(Boolean).slice(0, MAX_LIST_SIZE);
}

function normalizedGroups(source) {
  const data = rootData(source);
  if (Array.isArray(data)) return [{ title: 'Rankings', items: normalizedNovels(data) }];
  const groups = [];
  let remaining = MAX_LIST_SIZE;
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (remaining <= 0) break;
      const list = Array.isArray(value) ? value : findList(value);
      const items = list.map(novelRecord).filter(Boolean).slice(0, remaining);
      if (items.length) {
        groups.push({ title: text(value?.title ?? value?.name ?? key, 100), items });
        remaining -= items.length;
      }
    }
  }
  if (!groups.length) {
    const list = normalizedNovels(data);
    if (list.length) groups.push({ title: 'Rankings', items: list });
  }
  return groups.slice(0, 20);
}

function boundedParam(params, key, maxLength, required = false) {
  const value = text(params.get(key) || '', maxLength);
  if (required && !value) throw new Error('A required query parameter is missing.');
  if (value && !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('A query parameter is invalid.');
  return value;
}

function pageNumber(value) {
  const number = Number.parseInt(value || '1', 10);
  return Number.isFinite(number) && number > 0 ? Math.min(number, 10000) : 1;
}

function pageSize(value) {
  const number = Number.parseInt(value || '20', 10);
  return Number.isFinite(number) && number > 0 ? Math.min(number, MAX_LIST_SIZE) : 20;
}

function upstreamPath(action, params) {
  const page = pageNumber(params.get('page'));
  const size = pageSize(params.get('size'));
  const pagedPath = (path) => `${path}?page=${page}&size=${size}`;
  if (action === 'home') return [pagedPath('/v1/novels/home'), 'catalog'];
  if (action === 'search') {
    const keyword = text(params.get('keyword') || '', 100);
    if (!keyword) throw new Error('A search keyword is required.');
    return [`/v1/novels/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}`, 'catalog'];
  }
  if (action === 'genres') {
    const genreId = boundedParam(params, 'genreId', 128);
    if (genreId) return [`${pagedPath('/v1/novels/genres')}&genreId=${encodeURIComponent(genreId)}`, 'catalog'];
    return params.has('page') || params.has('size') ? [pagedPath('/v1/novels/genres'), 'catalog'] : ['/v1/novels/genres', 'catalog'];
  }
  if (action === 'suggestions') {
    const keyword = text(params.get('q') || params.get('keyword') || '', 100);
    const query = new URLSearchParams({ size: String(size) });
    if (keyword) query.set('q', keyword);
    return [`/v1/novels/suggestions?${query.toString()}`, 'catalog'];
  }
  if (action === 'recommendations') return [pagedPath('/v1/novels/recommendations'), 'catalog'];
  if (action === 'operations') return [pagedPath('/v1/novels/operations'), 'catalog'];
  if (action === 'rank-groups') return [pagedPath('/v1/novels/rank-groups'), 'catalog'];
  if (action === 'detail') {
    const novelId = boundedParam(params, 'novelId', 128) || boundedParam(params, 'contentId', 128) || boundedParam(params, 'id', 128);
    if (!novelId) throw new Error('A novel ID is required.');
    return [`/v1/novels/detail?novelId=${encodeURIComponent(novelId)}`, 'catalog'];
  }
  if (action === 'chapters') {
    const novelId = boundedParam(params, 'novelId', 128) || boundedParam(params, 'contentId', 128) || boundedParam(params, 'id', 128);
    if (!novelId) throw new Error('A novel ID is required.');
    return [`/v1/novels/chapters?novelId=${encodeURIComponent(novelId)}&page=${page}&size=${size}`, 'catalog'];
  }
  if (action === 'chapter') {
    const chapterId = boundedParam(params, 'chapterId', 128, true);
    return [`/v1/novels/chapter?chapterId=${encodeURIComponent(chapterId)}`, 'none'];
  }
  throw new Error('The requested action is not supported.');
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const action = params.get('action') || '';
  if (!ACTIONS.has(action)) return json({ ok: false, error: 'Unsupported action.' }, 400);
  const page = pageNumber(params.get('page'));
  const size = pageSize(params.get('size'));
  let path;
  let cache;
  try {
    [path, cache] = upstreamPath(action, params);
  } catch (error) {
    return json({ ok: false, error: error.message }, 400);
  }

  try {
    const source = await frameXJson(path, { cache });
    const data = rootData(source);
    if (action === 'chapter') {
      const chapterId = boundedParam(params, 'chapterId', 128, true);
      const record = data && typeof data === 'object' && !Array.isArray(data) ? data.chapter ?? data : {};
      const content = typeof record.content === 'string' ? record.content.slice(0, MAX_CHAPTER_CONTENT) : '';
      return json({ ok: true, action, chapter: {
        chapterId,
        chapterName: text(record.chapterName ?? record.title, 300),
        content,
        contentTruncated: typeof record.content === 'string' && record.content.length > MAX_CHAPTER_CONTENT,
        seq: safeCount(record.seq),
        totalWords: safeCount(record.totalWords)
      } });
    }
    if (action === 'detail') {
      const record = data && typeof data === 'object' && !Array.isArray(data) ? data.novel ?? data : {};
      const item = novelRecord(record);
      return item ? json({ ok: true, action, item }) : json({ ok: false, error: 'Novel details are unavailable.' }, 502);
    }
    if (action === 'chapters') {
      const chapters = findList(data).map((item) => {
        if (!item || typeof item !== 'object') return null;
        const chapterId = text(item.chapterId ?? item.id, 128);
        if (!chapterId) return null;
        return {
          chapterId,
          chapterName: text(item.chapterName ?? item.title, 300),
          seq: safeCount(item.seq),
          totalWords: safeCount(item.totalWords)
        };
      }).filter(Boolean).slice(0, pageSize(params.get('size')));
      return json({ ok: true, action, page: pageNumber(params.get('page')), size: pageSize(params.get('size')), items: chapters });
    }
    if (action === 'genres') return json({ ok: true, action, items: genreRecords(data) });
    if (action === 'rank-groups') return json({ ok: true, action, groups: normalizedGroups(data) });
    if (action === 'home' && data && !Array.isArray(data) && typeof data === 'object') {
      const sections = [];
      let remaining = MAX_LIST_SIZE;
      for (const [key, value] of Object.entries(data)) {
        if (remaining <= 0) break;
        const list = Array.isArray(value) ? value : findList(value);
        const items = list.map(novelRecord).filter(Boolean).slice(0, remaining);
        if (items.length) {
          sections.push({ title: text(value?.title ?? value?.name ?? key, 100), items });
          remaining -= items.length;
        }
      }
      const items = normalizedNovels(data);
      return json({ ok: true, action, items, sections: sections.slice(0, 20) });
    }
    const items = normalizedNovels(data, pageSize(params.get('size')));
    return json({ ok: true, action, items, page: action === 'search' ? page : undefined, size: action === 'search' ? size : undefined });
  } catch (error) {
    console.error('NovelHub request failed:', error?.message || 'Unknown error');
    return json({ ok: false, error: 'Novel service is temporarily unavailable.' }, 502);
  }
}
