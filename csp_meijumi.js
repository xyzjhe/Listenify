// 美剧迷 - https://www.meijumi.net/
// 分类: 美剧/英剧/韩剧/2026新剧 等
// 返回磁力链接（VOD类型）

const site = 'https://www.meijumi.net'
const headers = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  'Referer': site
}

async function getConfig() {
  return jsonify({
    ver: 1,
    title: '美剧迷',
    site: site,
    tabs: [
      { name: '首页', ext: { id: 'home' } },
      { name: '美剧', ext: { id: 'usa' } },
      { name: '英剧', ext: { id: 'en' } },
      { name: '韩剧', ext: { id: 'hanju' } },
      { name: '2026新剧', ext: { id: '2026xinju' } },
      { name: '最近更新', ext: { id: 'news' } },
      { name: '好剧推荐', ext: { id: 'haoju' } }
    ]
  })
}

// 从HTML中用正则提取所有详情页链接和标题
function extractCardsFromHTML(html) {
  const cards = []
  
  // 移除 HTML 注释，否则注释中的代码会干扰正则
  const clean = html.replace(/<!--[\s\S]*?-->/g, '')
  
  // 匹配 xpic 结构中的详情链接（首页/分类页通用）
  const linkRe = /<a[^>]+href="(https?:\/\/www\.meijumi\.net\/\d+\.html)"[^>]+title="([^"]+)"[^>]*>[\s\n\r\t]*<img[^>]+class="home-thumb"[^>]+src="([^"]+)"/g
  let m
  while ((m = linkRe.exec(clean)) !== null) {
    const href = m[1]
    const title = m[2].replace(/&#8216;/g, "'").replace(/&#8211;/g, '-').replace(/&#(\d+);/g, '')
    const pic = m[3]
    const vid = href.match(/\/(\d+)\.html/)?.[1] || ''
    if (title && vid && !cards.some(c => c.vod_id === vid)) {
      cards.push({ vod_id: vid, vod_name: title, vod_pic: pic, vod_remarks: '', ext: { url: href } })
    }
  }
  
  // 如果 xpic 没匹配到，尝试 article 结构
  if (cards.length === 0) {
    // 匹配 article.archive-list 中的标题和图片
    const artRe = /<article[^>]*class="archive-list"[^>]*>[\s\n\r\t]*<figure[^>]*>[\s\n\r\t]*<a[^>]+href="(https?:\/\/www\.meijumi\.net\/\d+\.html)"[^>]+title="([^"]+)"[^>]*>[\s\n\r\t]*<img[^>]+class="home-thumb"[^>]+src="([^"]+)"/g
    while ((m = artRe.exec(clean)) !== null) {
      const href = m[1]
      const title = m[2].replace(/&#8216;/g, "'").replace(/&#8211;/g, '-').replace(/&#(\d+);/g, '')
      const pic = m[3]
      const vid = href.match(/\/(\d+)\.html/)?.[1] || ''
      if (title && vid && !cards.some(c => c.vod_id === vid)) {
        cards.push({ vod_id: vid, vod_name: title, vod_pic: pic, vod_remarks: '', ext: { url: href } })
      }
    }
  }
  
  return cards
}

async function getCards(ext) {
  ext = argsify(ext)
  const { page = 1, id } = ext

  let url
  if (id === 'home') {
    url = page === 1 ? site + '/' : site + '/page/' + page + '/'
  } else if (id === 'news') {
    url = page === 1 ? site + '/news/' : site + '/news/page/' + page + '/'
  } else {
    url = page === 1 ? site + '/' + id + '/' : site + '/' + id + '/page/' + page + '/'
  }

  const { data } = await $fetch.get(url, { headers })
  const cards = extractCardsFromHTML(data)

  return jsonify({ list: cards })
}

async function getTracks(ext) {
  ext = argsify(ext)
  const { url } = ext

  const { data } = await $fetch.get(url, { headers })
  const clean = data.replace(/<!--[\s\S]*?-->/g, '')

  const tracks = []
  const episodes = []

  // 解码 HTML 实体
  const decoded = clean.replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
  
  // 匹配磁力链接（同时捕获链接文字）
  const magnetRe = /href="(magnet:\?xt=urn:btih:[a-fA-F0-9]+[^"]*)"[^>]*>([^<]+)<\/a>/g
  let m
  while ((m = magnetRe.exec(decoded)) !== null) {
    const name = m[2].trim() || '磁力链接'
    episodes.push({ name: name, pan: m[1], ext: { url: m[1] } })
  }

  // 匹配网盘链接（单独分支，不受磁力影响）
  const panRe = /<a[^>]+href="(https?:\/\/pan\.(?:xunlei|baidu|quark)[^"]+)"[^>]*>([^<]+)<\/a>/g
  while ((m = panRe.exec(decoded)) !== null) {
    const name = m[2].trim() || '网盘下载'
    if (!episodes.some(e => e.pan === m[1])) {
      episodes.push({ name: name, pan: m[1], ext: { url: m[1] } })
    }
  }

  if (episodes.length > 0) {
    tracks.push({ title: '下载', tracks: episodes })
  }

  return jsonify({ list: tracks })
}

async function getPlayinfo(ext) {
  ext = argsify(ext)
  let { url } = ext

  if (url.startsWith('magnet:')) {
    return jsonify({ urls: [url] })
  }

  if (url.startsWith('http')) {
    try {
      const { data } = await $fetch.get(url, { headers })
      const match = data.match(/href="(magnet:\?xt=urn:btih:[a-fA-F0-9]+)"/)
      if (match) {
        return jsonify({ urls: [match[1]] })
      }
    } catch (e) {}
  }

  return jsonify({ urls: [url] })
}

async function search(ext) {
  ext = argsify(ext)
  const { text, page = 1 } = ext
  const searchUrl = site + '/?s=' + encodeURIComponent(text) + (page > 1 ? '&paged=' + page : '')

  const { data } = await $fetch.get(searchUrl, { headers })
  const cards = extractCardsFromHTML(data)

  return jsonify({ list: cards })
}

async function getLocalInfo() {
  const appConfig = {
    ver: 1,
    name: '美剧迷',
    api: 'csp_meijumi'
  }
  return jsonify(appConfig)
}