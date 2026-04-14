// 盤搜 XPTV 源
// 網站: https://so.252035.xyz
// 功能: 搜索夸克/UC/115/阿里雲盤資源
// 類型: 網盤搜索源（需要對應網盤 APP 或插件才能播放）

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SITE = 'https://so.252035.xyz';
const API_SEARCH = `${SITE}/api/search`;

// 豆瓣 API 配置（需要微信小程序 UA 才能訪問）
const DOUBAN_API = 'https://frodo.douban.com/api/v2';
const DOUBAN_KEY = '0ac44ae016490db2204ce0a042db2916';
const DOUBAN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.0(20422342) NetType/WIFI Language/zh_CN',
  'Referer': 'https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html',
  'Accept': 'application/json'
};

// 網盤類型中文名
const PAN_NAMES = {
  'quark': '夸克網盤',
  'uc': 'UC網盤',
  '115': '115網盤',
  'aliyun': '阿里雲盤'
};

// ==================== 工具函數 ====================

// 從豆瓣 API 獲取數據
async function fetchDouban(path, params = {}) {
  try {
    const query = new URLSearchParams({
      apikey: DOUBAN_KEY,
      ...params
    }).toString();
    const url = `${DOUBAN_API}${path}?${query}`;
    const { data } = await $fetch.get(url, { headers: DOUBAN_HEADERS });
    return argsify(data);
  } catch (e) {
    console.error('豆瓣 API 錯誤:', e.message);
    return null;
  }
}

// 搜索網盤資源
async function searchPans(keyword) {
  try {
    const url = `${API_SEARCH}?cloud_types=quark,uc,115,aliyun&kw=${encodeURIComponent(keyword)}`;
    const { data } = await $fetch.get(url, {
      headers: { 'User-Agent': UA, 'Referer': SITE + '/' }
    });
    const result = argsify(data);
    if (result && result.code === 0 && result.data) {
      return result.data.merged_by_type || {};
    }
  } catch (e) {
    console.error('搜索錯誤:', e.message);
  }
  return {};
}

// ==================== XPTV 接口 ====================

async function getLocalInfo() {
  return jsonify({
    ver: 1,
    name: '盤搜',
    api: 'csp_pansou',
    type: 3
  });
}

async function getConfig() {
  return jsonify({
    ver: 1,
    title: '盤搜',
    site: SITE,
    tabs: [
      { name: '熱門電影', ext: { action: 'hot_movie' } },
      { name: '熱播劇集', ext: { action: 'tv_hot' } },
      { name: '熱播綜藝', ext: { action: 'show_hot' } },
      { name: '電影榜單', ext: { action: 'rank_movie' } },
      { name: '電視榜單', ext: { action: 'rank_tv' } }
    ]
  });
}

// 返回豆瓣熱門影視列表（點擊後會調用 getTracks 搜索網盤）
async function getCards(ext) {
  ext = argsify(ext);
  const { action, page = 1 } = ext;
  const count = 20;
  const start = (page - 1) * count;
  const list = [];

  try {
    let items = [];
    let total = 0;

    if (action === 'hot_movie') {
      const res = await fetchDouban('/movie/hot_gaia', { sort: 'recommend', area: '全部', start, count });
      if (res) { items = res.items || []; total = res.total || 0; }
    } else if (action === 'tv_hot') {
      const res = await fetchDouban('/subject_collection/tv_hot/items', { start, count });
      if (res) { items = res.subject_collection_items || []; total = res.total || 0; }
    } else if (action === 'show_hot') {
      const res = await fetchDouban('/subject_collection/show_hot/items', { start, count });
      if (res) { items = res.subject_collection_items || []; total = res.total || 0; }
    } else if (action === 'rank_movie') {
      const res = await fetchDouban('/subject_collection/movie_real_time_hotest/items', { start, count });
      if (res) { items = res.subject_collection_items || []; total = res.total || 0; }
    } else if (action === 'rank_tv') {
      const res = await fetchDouban('/subject_collection/tv_real_time_hotest/items', { start, count });
      if (res) { items = res.subject_collection_items || []; total = res.total || 0; }
    }

    for (const item of items) {
      if (item.type === 'movie' || item.type === 'tv') {
        const rating = item.rating ? item.rating.value : 0;
        const ratingStr = rating ? rating.toFixed(1) : '暫無評分';
        const title = item.title || '未知';
        const pic = (item.pic && item.pic.normal) || '';
        const honor = (item.honor_infos || []).map(h => h.title).join(' | ');
        const remarks = honor ? `${ratingStr} | ${honor}` : ratingStr;

        list.push({
          vod_id: `search:${title}`,
          vod_name: title,
          vod_pic: pic,
          vod_remarks: remarks,
          ext: { keyword: title }
        });
      }
    }

    const totalPages = Math.ceil(total / count) || 1;
    return jsonify({ list, page, pagecount: totalPages });
  } catch (e) {
    console.error('getCards 錯誤:', e.message);
    return jsonify({ list, page });
  }
}

// 搜索網盤資源並返回播放線路
async function getTracks(ext) {
  ext = argsify(ext);
  const { keyword } = ext;

  if (!keyword) {
    return jsonify({ list: [] });
  }

  const mergedByType = await searchPans(keyword);
  const lines = [];
  const processedUrls = new Set();

  for (const type in mergedByType) {
    const links = mergedByType[type];
    if (!Array.isArray(links) || links.length === 0) continue;

    const tracks = [];
    for (const link of links) {
      if (!link.url || processedUrls.has(link.url)) continue;
      processedUrls.add(link.url);

      let name = (link.note || link.title || '未知資源').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (name.length > 60) name = name.substring(0, 60) + '...';

      tracks.push({
        name: name,
        pan: link.url,
        ext: {}
      });
    }

    if (tracks.length > 0) {
      lines.push({
        title: PAN_NAMES[type] || type.toUpperCase(),
        tracks: tracks
      });
    }
  }

  return jsonify({ list: lines });
}

// 網盤源：直接返回空，XPTV 調用網盤插件播放
async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

// 搜索功能（返回網盤資源列表）
async function search(ext) {
  ext = argsify(ext);
  const { text, wd } = ext;
  const keyword = text || wd || '';

  if (!keyword) {
    return jsonify({ list: [], page: 1 });
  }

  const mergedByType = await searchPans(keyword);
  const list = [];
  const processedUrls = new Set();
  const maxResults = 50;

  for (const type in mergedByType) {
    const links = mergedByType[type];
    if (!Array.isArray(links)) continue;

    for (const link of links) {
      if (!link.url || processedUrls.has(link.url)) continue;
      processedUrls.add(link.url);
      if (list.length >= maxResults) break;

      let name = (link.note || link.title || '未知資源').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      let pic = '';
      if (link.images && Array.isArray(link.images) && link.images.length > 0) {
        pic = link.images[0];
      }

      const typeName = PAN_NAMES[type] || type.toUpperCase();
      const source = link.source ? ` | ${link.source.replace('tg:', '')}` : '';

      list.push({
        vod_id: link.url,
        vod_name: name,
        vod_pic: pic,
        vod_remarks: `${typeName}${source}`,
        ext: { keyword: name }
      });
    }
  }

  return jsonify({ list, page: 1 });
}
