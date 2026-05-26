"use client";

import { useState } from "react";
import useSWR from "swr";
import { format, isToday, isYesterday } from "date-fns";
import { Music, Send, Loader2, PlayCircle, Apple, Disc3, Calendar } from "lucide-react";

const GENRES = ["全部", "流行", "摇滚", "电子", "说唱", "民谣", "爵士/布鲁斯", "古典", "ACG", "其他"];
const LANGUAGES = ["全部", "华语", "欧美", "日语", "韩语", "粤语", "纯音乐", "其他"];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Home() {
  const [activeGenre, setActiveGenre] = useState("全部");
  const [activeLanguage, setActiveLanguage] = useState("全部");
  const [url, setUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [cover, setCover] = useState("");
  const [genre, setGenre] = useState("流行");
  const [language, setLanguage] = useState("华语");
  const [comment, setComment] = useState("");
  const [platform, setPlatform] = useState("unknown");

  const { data, mutate } = useSWR(`/api/songs?genre=${activeGenre}&language=${activeLanguage}`, fetcher, {
    revalidateOnFocus: true,
    revalidateOnMount: true
  });

  const handleParse = async (inputUrl: string) => {
    if (!inputUrl) return;
    setParsing(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });
      const result = await res.json();
      if (result.success) {
        setTitle(result.data.title || "");
        setArtist(result.data.artist || "");
        setCover(result.data.cover || "");
        setPlatform(result.data.platform || "unknown");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !title) return;
    setSubmitting(true);
    try {
      await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title, artist, cover, genre, language, comment, platform }),
      });
      // Reset form
      setUrl("");
      setTitle("");
      setArtist("");
      setCover("");
      setComment("");
      // Force mutate all SWR caches for this API
      mutate();
      // Optional: Give it a slight delay and mutate again to be absolutely sure
      setTimeout(() => mutate(), 500);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans pb-20">
      <header className="bg-white sticky top-0 z-10 border-b border-neutral-200 px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Disc3 className="w-6 h-6 text-indigo-600" />
          <h1 className="text-xl font-bold tracking-tight">打捞 (Dredge)</h1>
          <span className="text-sm text-neutral-500 ml-2">每日好歌共享池</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 mt-8 space-y-12">
        {/* Submit Section */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-500" />
            投递一首好歌
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-600 mb-1">链接 (网易云/Apple Music)</label>
              <input
                type="url"
                required
                className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="在此粘贴分享链接..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={(e) => handleParse(e.target.value)}
              />
              {parsing && <p className="text-xs text-indigo-500 mt-2 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> 解析中...</p>}
            </div>

            {title && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1">歌名</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full px-4 py-2 border border-neutral-200 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1">歌手</label>
                  <input type="text" value={artist} onChange={e => setArtist(e.target.value)} className="w-full px-4 py-2 border border-neutral-200 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1">流派</label>
                  <select value={genre} onChange={e => setGenre(e.target.value)} className="w-full px-4 py-2 border border-neutral-200 rounded-lg outline-none bg-white">
                    {GENRES.filter(g => g !== "全部").map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1">语种</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full px-4 py-2 border border-neutral-200 rounded-lg outline-none bg-white">
                    {LANGUAGES.filter(l => l !== "全部").map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-600 mb-1">推荐语 (可选)</label>
                  <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="前奏一响，直接沦陷..." className="w-full px-4 py-2 border border-neutral-200 rounded-lg outline-none" />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button disabled={!title || submitting} type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "分享到池子"}
              </button>
            </div>
          </form>
        </section>

        {/* Feed Section */}
        <section>
          {/* Filters Tabs */}
          <div className="space-y-3 pb-4">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
              <span className="text-sm font-medium text-neutral-400 shrink-0 w-8">流派</span>
              <div className="flex gap-2">
                {GENRES.map(g => (
                  <button
                    key={g}
                    onClick={() => setActiveGenre(g)}
                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeGenre === g 
                        ? "bg-indigo-600 text-white shadow-md" 
                        : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
              <span className="text-sm font-medium text-neutral-400 shrink-0 w-8">语种</span>
              <div className="flex gap-2">
                {LANGUAGES.map(l => (
                  <button
                    key={l}
                    onClick={() => setActiveLanguage(l)}
                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeLanguage === l 
                        ? "bg-teal-600 text-white shadow-md" 
                        : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="mt-2">
            {!data && <div className="text-center text-neutral-400 py-10">加载中...</div>}
            {data?.data?.length === 0 && (
              <div className="text-center text-neutral-400 py-10 bg-white rounded-2xl border border-neutral-100">
                <Music className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>暂无符合条件的歌曲，快来投递第一首吧！</p>
              </div>
            )}
            
            {(() => {
              if (!data?.data || data.data.length === 0) return null;
              
              // Group songs by date
              const groupedSongs = data.data.reduce((acc: any, song: any) => {
                const dateStr = format(new Date(song.createdAt), "yyyy-MM-dd");
                if (!acc[dateStr]) acc[dateStr] = [];
                acc[dateStr].push(song);
                return acc;
              }, {} as Record<string, any[]>);

              return Object.entries(groupedSongs).map(([dateStr, songs]) => {
                const dateObj = new Date(dateStr);
                let dateLabel = format(dateObj, "M月d日");
                if (isToday(dateObj)) dateLabel = "今天";
                else if (isYesterday(dateObj)) dateLabel = "昨天";

                return (
                  <div key={dateStr} className="mb-10">
                    <div className="flex items-center gap-2 mb-4 sticky top-20 bg-neutral-50/90 backdrop-blur z-10 py-2">
                      <Calendar className="w-5 h-5 text-indigo-500" />
                      <h3 className="text-lg font-bold text-neutral-800">{dateLabel} <span className="text-sm font-normal text-neutral-400 ml-1">投递</span></h3>
                    </div>
                    
                    <div className="space-y-4">
                      {songs.map((song: any) => {
                        const query = encodeURIComponent(`${song.title} ${song.artist}`);
                        const neteaseLink = song.platform === "netease" ? song.url : `https://music.163.com/#/search/m/?s=${query}`;
                        const appleLink = song.platform === "apple" ? song.url : `https://music.apple.com/search?term=${query}`;

                        return (
                          <div
                            key={song.id}
                            className="group block bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 hover:shadow-md transition-all"
                          >
                            <div className="flex gap-4 items-start">
                              <div className="relative shrink-0">
                                <img 
                                  src={song.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=200&h=200"} 
                                  alt={song.title} 
                                  className="w-24 h-24 rounded-xl object-cover"
                                />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <h3 className="font-semibold text-lg text-neutral-900 truncate">{song.title}</h3>
                                    <p className="text-sm text-neutral-500 truncate">{song.artist}</p>
                                  </div>
                                  {song.platform === "netease" ? (
                                    <span className="text-xs px-2 py-1 bg-neutral-50 text-neutral-500 rounded-md shrink-0">来源: 网易云</span>
                                  ) : song.platform === "apple" ? (
                                    <span className="text-xs px-2 py-1 bg-neutral-50 text-neutral-500 rounded-md shrink-0">来源: Apple</span>
                                  ) : null}
                                </div>

                                {song.comment && (
                                  <p className="mt-3 text-sm text-neutral-700 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 line-clamp-2">
                                    “{song.comment}”
                                  </p>
                                )}

                                <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{song.genre}</span>
                                  {song.language !== "其他" && (
                                    <span className="px-2 py-0.5 bg-teal-50 text-teal-600 rounded-full">{song.language}</span>
                                  )}
                                  <span className="ml-1">{format(new Date(song.createdAt), "HH:mm")}</span>
                                </div>
                                
                                {/* 多平台跳转按钮 */}
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <a 
                                    href={neteaseLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                                  >
                                    <Disc3 className="w-4 h-4" />
                                    在网易云播放
                                  </a>
                                  <a 
                                    href={appleLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded-lg text-sm font-medium transition-colors"
                                  >
                                    <Apple className="w-4 h-4" />
                                    在 Apple Music 播放
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </section>
      </div>
    </main>
  );
}
