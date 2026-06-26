import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getEnabledApiEndpoints, getProxyUrl } from '../settings';

export interface OnlineSong {
  id: string;
  name: string;
  artist: string;
  album: string;
  source: string;
  url_id: string;
  pic_id: string;
  lyric_id: string;
  pic: string | null;
  url: string | null;
  duration: number;
  has_hires: boolean;
}

export interface OnlinePlaylist {
  id: string;
  name: string;
  cover: string;
  creatorName: string;
  creatorAvatar: string | null;
  count?: number;
  playCount?: number;
  trackCount?: number;
}

export interface ToplistDetail extends OnlinePlaylist {
  topTracks: {
    first: string;
    second: string;
  }[];
}

export interface PlaylistDetail extends OnlinePlaylist {
  item: OnlineSong[];
}

async function postRequest(types: string, extraParams: Record<string, any>): Promise<any> {
  const endpoints = getEnabledApiEndpoints();
  if (endpoints.length === 0) {
    throw new Error('No third-party API endpoints enabled');
  }

  let lastError: any;

  for (const endpoint of endpoints) {
    try {
      const proxyUrl = getProxyUrl();

      const url = new URL(`${endpoint}/api.php`);
      url.searchParams.append('types', types);
      for (const [key, value] of Object.entries(extraParams)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      }

      let response;
        if (endpoint.includes('gdstudio.xyz')) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          response = await window.fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'zh-CN,zh;q=0.9'
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (e: any) {
          if (e.name === 'AbortError' || String(e).includes('Failed to fetch') || String(e).includes('NetworkError')) {
            throw new Error('网络连接超时或被阻止。\n\n[诊断建议]\n此API受防火墙保护，已切换为系统底层网络引擎，请确保您已开启了 [Clash 客户端](global) 或 [TUN Mode]\n*(软件内的代理设置对此API无效)*');
          }
          throw new Error('网络连接失败: ' + String(e));
        }
      } else {
        const fetchOptions: any = {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': `${endpoint}/`,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh,q=0.9'
          },
          danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
        };

        if (proxyUrl) {
          fetchOptions.proxy = { all: proxyUrl };
        }
        response = await tauriFetch(url.toString(), fetchOptions);
      }

      if (!response.ok) {
        throw new Error(`API error at ${endpoint}, status: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.warn(`Request failed for endpoint ${endpoint}:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('All third-party endpoints failed');
}

function firstString(...args: any[]): string {
  for (const arg of args) {
    if (typeof arg === 'string' && arg.trim() !== '') {
      return arg.trim();
    }
  }
  return '';
}

function resolveImageUrl(...args: any[]): string | null {
  for (const arg of args) {
    if (typeof arg === 'string' && arg.trim() !== '') {
      let url = arg.trim();
      if (url.startsWith('//y/')) {
        url = url.replace('//y/', 'http://y');
      }
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }
      if (url.startsWith('http')) {
        return url;
      }
    }
  }
  return null;
}

function mapOnlineSong(item: any, fallbackSource: string): OnlineSong {
  const arNames = Array.isArray(item.ar) ? item.ar.map((ar: any) => ar.name).join(', ') : '';
  const artist = Array.isArray(item.artist)
    ? item.artist.join(', ')
    : firstString(item.artist, arNames, item.singer, '未知歌手');
  const album = firstString(item.album, item.al?.name, item.albumName, '未知专辑');
  const duration = Number(item.extra_data?.duration || item.duration || (item.dt ? Math.floor(Number(item.dt) / 1000) : 0));

  return {
    id: String(item.id),
    name: firstString(item.name, item.title, '未知歌曲'),
    artist,
    album,
    source: firstString(item.source, fallbackSource),
    url_id: String(item.url_id || item.id),
    pic_id: String(item.pic_id || item.al?.pic || item.id || ''),
    lyric_id: String(item.lyric_id || item.id),
    pic: resolveImageUrl(item.pic, item.picUrl, item.al?.picUrl, item.cover) || null,
    url: firstString(item.url) || null,
    duration,
    has_hires: !!(item.extra_data?.has_hires || (item.sq?.br && item.sq.br > 320000)),
  };
}

function mapPlaylist(item: any): OnlinePlaylist {
  const creator = item.creator || item.creatorName || item.user || item.author || {};

  return {
    id: String(item.id),
    name: firstString(item.name, item.title, '未知歌单名'),
    cover: resolveImageUrl(
      item.cover,
      item.coverImgUrl,
      item.picUrl,
      item.picture,
      item.img,
      item.image,
      item.cover_url,
      item.coverUrl,
      item.pic
    ) || '',
    creatorName: firstString(
      typeof creator === 'object' ? creator.nickname : creator,
      typeof creator === 'object' ? creator.name : '',
      item.creatorName,
      item.nickname,
      item.author
    ),
    creatorAvatar: resolveImageUrl(
      typeof creator === 'object' ? creator.avatarUrl : '',
      item.creatorAvatar,
      item.avatarUrl
    ),
    count: Number(item.count || item.trackCount || item.playCount || 0),
    playCount: Number(item.playCount || 0),
    trackCount: Number(item.trackCount || item.count || 0),
  };
}

export const MusicApiService = {
  async searchArtist(keyword: string): Promise<any> {
    try {
      const response = await tauriFetch(`http://music.163.com/api/cloudsearch/pc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://music.163.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: `s=${encodeURIComponent(keyword)}&type=100&limit=1&offset=0`,
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.code === 200 && data?.result?.artists && data.result.artists.length > 0) {
          const artist = data.result.artists[0];
          return {
            id: String(artist.id),
            name: artist.name,
            picUrl: artist.picUrl || artist.img1v1Url || '',
            source: 'netease',
          };
        }
      }
      return null;
    } catch (err) {
      console.warn('Search artist failed', err);
      return null;
    }
  },

  async searchSongs(keyword: string, source: string = 'netease', page: number = 1): Promise<OnlineSong[]> {
    try {
      if (source === 'netease') {
        const limit = 30;
        const offset = (page - 1) * limit;
        try {
          const response = await tauriFetch(`http://music.163.com/api/cloudsearch/pc`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Referer': 'https://music.163.com'
            },
            body: `s=${encodeURIComponent(keyword)}&type=1&limit=${limit}&offset=${offset}`,
          });
          if (response.ok) {
            const data = await response.json();
            if (data?.code === 200 && data?.result?.songs) {
              return data.result.songs.map((item: any) => mapOnlineSong(item, source));
            }
          }
        } catch (err) {
          console.warn('Official song search failed, falling back to third-party', err);
        }
      }

      const data = await postRequest('search', {
        count: '30',
        source,
        pages: String(page),
        name: keyword,
      });

      if (!Array.isArray(data)) return [];
      return data.map((item: any) => mapOnlineSong(item, source));
    } catch (err) {
      console.error('Search songs error:', err);
      throw err;
    }
  },

  async searchPlaylists(keyword: string, page: number = 1): Promise<OnlinePlaylist[]> {
    try {
      const limit = 30;
      const offset = (page - 1) * limit;
      let data: any = null;

      try {
        const response = await tauriFetch(`http://music.163.com/api/cloudsearch/pc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://music.163.com'
          },
          body: `s=${encodeURIComponent(keyword)}&type=1000&limit=${limit}&offset=${offset}`,
        });
        if (response.ok) {
          data = await response.json();
        }
      } catch (err) {
        console.warn('Cloudsearch API failed, falling back to old search API', err);
      }

      if (!data || data.code !== 200) {
        const response = await tauriFetch(`http://music.163.com/api/search/get/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://music.163.com'
          },
          body: `s=${encodeURIComponent(keyword)}&type=1000&limit=${limit}&offset=${offset}`,
        });
        if (response.ok) {
          data = await response.json();
        }
      }

      if (!data || data.code !== 200 || !data.result || !data.result.playlists) {
        return [];
      }

      return data.result.playlists.map((item: any) => mapPlaylist(item));
    } catch (err) {
      console.error('Search playlists error:', err);
      throw err;
    }
  },

  async getSongUrl(songId: string, source: string, br: string = '320'): Promise<string | null> {
    try {
      if (source === 'netease') {
        try {
          const response = await tauriFetch(`http://music.163.com/api/song/enhance/player/url?id=${songId}&ids=[${songId}]&br=3200000`, {
            headers: { 'Referer': 'http://music.163.com' }
          });
          if (response.ok) {
            const data = await response.json();
            if (data?.data?.[0]?.url) return data.data[0].url;
          }
        } catch (e) {
          console.warn('Official getSongUrl failed', e);
        }
      }

      const data = await postRequest('url', { id: songId, source, br: String(br) });
      if (!data?.url) {
        alert(`API返回的数据中没有URL。返回: ${JSON.stringify(data).substring(0, 100)}`);
      }
      return data?.url || null;
    } catch (err: any) {
      console.error(`Get song URL error (ID: ${songId}, Source: ${source}):`, err);
      alert(`[调试信息] 请求播放链接出错: ${err.message || err}\n请截图该弹窗发给开发者`);
      return null;
    }
  },

  async getSongLyric(lyricId: string, source: string): Promise<string> {
    try {
      if (source === 'netease') {
        try {
          const response = await tauriFetch(`http://music.163.com/api/song/lyric?id=${lyricId}&lv=1&kv=1&tv=-1`, {
            method: 'GET',
            headers: { 'Referer': 'http://music.163.com' }
          });
          if (response.ok) {
            const data = await response.json();
            if (data?.lrc?.lyric) return data.lrc.lyric;
          }
        } catch (e) {
          console.warn('Official getSongLyric failed', e);
        }
      }

      const data = await postRequest('lyric', { id: lyricId, source });
      return data?.lyric || '';
    } catch (err) {
      console.error(`Get lyric error (ID: ${lyricId}, Source: ${source}):`, err);
      return '';
    }
  },


  async getSongPic(picId: string, source: string, size: string = '300'): Promise<string | null> {
    try {
      if (source === 'netease') {
        try {
          const response = await tauriFetch(`http://music.163.com/api/song/detail/?id=${picId}&ids=[${picId}]`, {
            method: 'GET',
            headers: { 'Referer': 'http://music.163.com' }
          });
          if (response.ok) {
            const data = await response.json();
            if (data?.songs?.[0]?.al?.picUrl) return data.songs[0].al.picUrl;
          }
        } catch (e) {
          console.warn('Official getSongPic failed', e);
        }
      }

      const data = await postRequest('pic', { id: picId, source, size: String(size) });
      return data?.url || null;
    } catch (err) {
      console.error(`Get pic error (ID: ${picId}, Source: ${source}):`, err);
      return null;
    }
  },

  async getPlaylistDetails(playlistId: string, isNeteaseDirect: boolean = false): Promise<PlaylistDetail | null> {
    try {
      if (isNeteaseDirect) {
        const res = await tauriFetch(`http://music.163.com/api/v6/playlist/detail?id=${playlistId}`, {
          method: 'POST',
          headers: { 'Referer': 'http://music.163.com' }
        });
        const data1 = await res.json();
        const playlist = data1.playlist;
        if (!playlist) return null;

        const trackIds = (playlist.trackIds || []).map((t: any) => ({ id: t.id }));
        const chunks = [];
        for (let i = 0; i < trackIds.length; i += 500) {
          chunks.push(trackIds.slice(i, i + 500));
        }

        let allSongs: any[] = [];
        for (const chunk of chunks) {
          const res2 = await tauriFetch(`http://music.163.com/api/v3/song/detail`, {
            method: 'POST',
            headers: {
              'Referer': 'http://music.163.com',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `c=${encodeURIComponent(JSON.stringify(chunk))}`
          });
          const data2 = await res2.json();
          if (data2.songs) allSongs = allSongs.concat(data2.songs);
        }

        return {
          id: playlistId,
          name: playlist.name,
          cover: playlist.coverImgUrl,
          creatorName: playlist.creator?.nickname || 'Official',
          creatorAvatar: playlist.creator?.avatarUrl || '',
          item: allSongs.map(song => mapOnlineSong({ ...song, source: 'netease' }, 'netease'))
        };
      }

      const data = await postRequest('playlist', { id: playlistId });
      const playlist = data?.playlist || data;
      if (!playlist) return null;

      const tracks = Array.isArray(playlist.tracks)
        ? playlist.tracks
        : Array.isArray(playlist.item)
          ? playlist.item
          : [];

      return {
        id: playlistId,
        name: firstString(playlist.name, playlist.title, 'Playlist'),
        cover: resolveImageUrl(playlist.coverImgUrl, playlist.cover, playlist.picUrl, playlist.picture) || '',
        creatorName: firstString(playlist.creator?.nickname, playlist.creator?.name, playlist.creator),
        creatorAvatar: resolveImageUrl(playlist.creator?.avatarUrl, playlist.creatorAvatar),
        item: tracks.map((track: any) => mapOnlineSong({ ...track, source: 'netease' }, 'netease')),
      };
    } catch (err) {
      console.error(`Get playlist details error (ID: ${playlistId}):`, err);
      throw err;
    }
  },

  async getNeteaseToplists(): Promise<ToplistDetail[]> {
    try {
      const fetchOptions: any = {
        method: 'GET',
        headers: { 
          'Referer': 'http://music.163.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };
      const proxyUrl = getProxyUrl();
      if (proxyUrl) {
        fetchOptions.proxy = { all: proxyUrl };
      }

      const response = await tauriFetch('http://music.163.com/api/toplist/detail', fetchOptions);
      if (!response.ok) return [];
      const data = await response.json();
      if (data.code !== 200) return [];

      if (Array.isArray(data.list)) {
        return data.list.slice(0, 4).map((tl: any) => ({
          id: String(tl.id),
          name: tl.name,
          cover: tl.coverImgUrl || tl.picUrl || '',
          creatorName: 'Official',
          creatorAvatar: '',
          playCount: tl.playCount,
          trackCount: tl.trackCount,
          topTracks: Array.isArray(tl.tracks) ? tl.tracks.map((t: any) => ({
            first: t.first,
            second: t.second
          })) : []
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch Netease Toplists:', err);
    }
    return [];
  },

  async getNeteaseHighQualityPlaylists(): Promise<OnlinePlaylist[]> {
    try {
      const fetchOptions: any = {
        method: 'GET',
        headers: { 
          'Referer': 'http://music.163.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };
      const proxyUrl = getProxyUrl();
      if (proxyUrl) {
        fetchOptions.proxy = { all: proxyUrl };
      }

      const response = await tauriFetch('http://music.163.com/api/playlist/highquality/list?limit=10', fetchOptions);
      if (!response.ok) return [];
      const data = await response.json();
      if (data.code === 200 && Array.isArray(data.playlists)) {
        return data.playlists.map((pl: any) => ({
          id: String(pl.id),
          name: pl.name,
          cover: pl.coverImgUrl || pl.picUrl || '',
          creatorName: pl.creator?.nickname || 'Unknown',
          creatorAvatar: pl.creator?.avatarUrl || '',
          playCount: pl.playCount,
          trackCount: pl.trackCount
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch high quality playlists:', err);
    }
    return [];
  },

  async getHotPlaylists(): Promise<OnlinePlaylist[]> {
    try {
      const data = await postRequest('hot_list', {});
      const playlists = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      return playlists.map((pl: any) => ({
        id: String(pl.id),
        name: pl.name || pl.title,
        cover: resolveImageUrl(pl.cover, pl.picUrl, pl.coverImgUrl),
        creatorName: pl.creator || 'Unknown',
        creatorAvatar: '',
        playCount: pl.playCount || 0,
        trackCount: pl.trackCount || 0
      }));
    } catch (err) {
      console.error('Failed to get hot playlists:', err);
      return [];
    }
  },

  async getNewSongs(): Promise<OnlineSong[]> {
    try {
      const fetchOptions: any = {
        method: 'GET',
        headers: { 
          'Referer': 'http://music.163.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };
      const proxyUrl = getProxyUrl();
      if (proxyUrl) {
        fetchOptions.proxy = { all: proxyUrl };
      }

      const response = await tauriFetch('http://music.163.com/api/personalized/newsong', fetchOptions);
      if (!response.ok) return [];
      const data = await response.json();
      if (data.code !== 200 || !Array.isArray(data.result)) return [];

      return data.result.map((item: any) => {
        const song = item.song || {};
        return mapOnlineSong({
          ...song,
          picUrl: song.album?.picUrl || item.picUrl || '',
          source: 'netease'
        }, 'netease');
      });
    } catch (err) {
      console.error('Failed to get new songs:', err);
      return [];
    }
  },

  async getTopArtists(): Promise<any[]> {
    try {
      const fetchOptions: any = {
        method: 'POST',
        headers: { 
          'Referer': 'http://music.163.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'limit=12&offset=0&type=1&area=7'
      };
      const proxyUrl = getProxyUrl();
      if (proxyUrl) {
        fetchOptions.proxy = { all: proxyUrl };
      }

      const response = await tauriFetch('http://music.163.com/api/artist/list', fetchOptions);
      if (!response.ok) return [];
      const data = await response.json();
      if (data.code !== 200 || !Array.isArray(data.artists)) return [];

      return data.artists.map((artist: any) => ({
        id: String(artist.id),
        name: artist.name,
        picUrl: artist.picUrl || artist.img1v1Url || '',
        source: 'netease',
      }));
    } catch (err) {
      console.error('Failed to get top artists:', err);
      return [];
    }
  }
};
