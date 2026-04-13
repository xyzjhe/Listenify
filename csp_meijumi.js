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
  const $ = createCheerio()
  const root = $(data)
  const cards = []

  // 首页使用 xpic 结构，分类页使用 article 结构
  const articles = root('article.archive-list')
  const xpicBlocks = root('div.xpic')
  
  // xpic 结构（首页确认可用）
  if (xpicBlocks.length > 0 && (id === 'home' || articles.length === 0)) {
    xpicBlocks.each((i, block) => {
      const picEl = block.querySelector('img.home-thumb')
      const linkEl = block.querySelector('div.cat-site-2 a')
      const remarksEl = block.querySelector('span.gxts-2')
      const pic = picEl?.getAttribute?.('src') || ''
      const href = linkEl?.getAttribute?.('href') || ''
      const title = linkEl?.textContent?.trim() || ''
      const remarks = remarksEl?.textContent?.trim() || ''
      const vid = href.match(/\/(\d+)\.html/)?.[1] || ''

      if (title && vid) {
        cards.push({
          vod_id: vid,
          vod_name: title,
          vod_pic: pic,
          vod_remarks: remarks,
          ext: { url: href }
        })
      }
    })
  }
  
  // article 结构（分类页使用）
  if (articles.length > 0) {
    articles.each((i, el) => {
      const titleEls = el.querySelectorAll('h2.entry-title a')
      const picEl = el.querySelector('figure.thumbnail img.home-thumb')
      const remarksEl = el.querySelector('.gxts')
      const title = titleEls[0]?.textContent?.trim() || ''
      const href = titleEls[0]?.getAttribute?.('href') || ''
      const pic = picEl?.getAttribute?.('src') || ''
      const remarks = remarksEl?.textContent?.trim() || ''
      const vid = href.match(/\/(\d+)\.html/)?.[1] || ''

      if (title && vid) {
        cards.push({
          vod_id: vid,
          vod_name: title,
          vod_pic: pic,
          vod_remarks: remarks,
          ext: { url: href }
        })
      }
    })
  }

  return jsonify({ list: cards })
}

async function getTracks(ext) {
  ext = argsify(ext)
  const { url } = ext

  const { data } = await $fetch.get(url, { headers })
  const $ = createCheerio()
  const root = $(data)

  const tracks = []
  const episodes = []

  root('a[href^="magnet:?xt="]').each((_, el) => {
    const href = el.getAttribute?.('href') || ''
    const text = el.textContent?.trim() || ''
    const epMatch = text.match(/S\d+E\d+/i) || text.match(/第\d+集/) || text.match(/\d+集/)
    const epName = epMatch ? text.substring(0, text.indexOf(epMatch[0]) + epMatch[0].length) : text
    episodes.push({ name: epName || text, pan: href, ext: { url: href } })
  })

  root('a[href*="xunlei.com"], a[href*="pan.xunlei"], a[href*="baidu.com"], a[href*="quark.cn"]').each((_, el) => {
    const href = el.getAttribute?.('href') || ''
    const text = el.textContent?.trim() || ''
    if (href && (href.startsWith('http') || href.startsWith('magnet'))) {
      episodes.push({ name: text || '网盘下载', pan: href, ext: { url: href } })
    }
  })

  if (episodes.length === 0) {
    const magnetRegex = /magnet:\?xt=urn:btih:[a-fA-F0-9]+/g
    let match
    while ((match = magnetRegex.exec(data)) !== null) {
      episodes.push({ name: '磁力链接', pan: match[0], ext: { url: match[0] } })
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
      const $ = createCheerio()
      const root = $(data)
      const magnet = root('a[href^="magnet:?xt="]').eq(0).attr('href')
      if (magnet) {
        return jsonify({ urls: [magnet] })
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
  const $ = createCheerio()
  const root = $(data)
  const cards = []

  // 搜索结果使用 xpic 结构或 cat-site-2
  const xpicBlocks = root('div.xpic')
  if (xpicBlocks.length > 0) {
    xpicBlocks.each((i, block) => {
      const picEl = block.querySelector('img.home-thumb')
      const linkEl = block.querySelector('div.cat-site-2 a')
      const pic = picEl?.getAttribute?.('src') || ''
      const href = linkEl?.getAttribute?.('href') || ''
      const title = linkEl?.textContent?.trim() || ''
      const vid = href.match(/\/(\d+)\.html/)?.[1] || ''

      if (title && vid) {
        cards.push({ vod_id: vid, vod_name: title, vod_pic: pic, vod_remarks: '', ext: { url: href } })
      }
    })
  } else {
    // Fallback: article structure
    const articles = root('article, .archive-list, .post')
    articles.each((i, el) => {
      const titleEls = el.querySelectorAll('h2 a, .entry-title a')
      const picEl = el.querySelector('img')
      const title = titleEls[0]?.textContent?.trim() || ''
      const href = titleEls[0]?.getAttribute?.('href') || ''
      const pic = picEl?.getAttribute?.('src') || ''
      const vid = href.match(/\/(\d+)\.html/)?.[1] || ''

      if (title && vid) {
        cards.push({ vod_id: vid, vod_name: title, vod_pic: pic, vod_remarks: '', ext: { url: href } })
      }
    })
  }

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