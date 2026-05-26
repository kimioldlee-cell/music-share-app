"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format, isToday, isYesterday } from "date-fns";
import { Music, Send, Loader2, PlayCircle, Apple, Disc3, Calendar, Trash2, Pin, Crown, ShieldCheck, Lock, Unlock, Heart } from "lucide-react";

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

  // Creator Mode State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [isFormCreator, setIsFormCreator] = useState(false);
  const [isFormPinned, setIsFormPinned] = useState(false);

  // Favorites State
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { data, mutate } = useSWR(`/api/songs?genre=${activeGenre}&language=${activeLanguage}`, fetcher, {
    revalidateOnFocus: true,
    revalidateOnMount: true
  });

  // Handle auto login from query param or localStorage
  useEffect(() => {
    const storedPasscode = localStorage.getItem("admin_passcode");
    if (storedPasscode) {
      setIsAdmin(true);
      setAdminPasscode(storedPasscode);
    }

    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");
    if (key === "Kimi84282106") {
      localStorage.setItem("admin_passcode", key);
      setIsAdmin(true);
      setAdminPasscode(key);
      alert("🎉 欢迎回来，主理人！管理模式已启用。");
      // Clean up the URL parameter to protect the passcode
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  // Load favorites from localStorage
  useEffect(() => {
    const storedFavorites = localStorage.getItem("dredge_favorites");
    if (storedFavorites) {
      try {
        setFavorites(JSON.parse(storedFavorites));
      } catch (e) {
        console.error("Error loading favorites:", e);
      }
    }
  }, []);

  const handleToggleFavorite = (id: string) => {
    let updatedFavorites;
    if (favorites.includes(id)) {
      updatedFavorites = favorites.filter(favId => favId !== id);
    } else {
      updatedFavorites = [...favorites, id];
    }
    setFavorites(updatedFavorites);
    localStorage.setItem("dredge_favorites", JSON.stringify(updatedFavorites));
  };

  const handleAdminLogin = () => {
    const password = prompt("请输入主理人密码:");
    if (password === "Kimi84282106") {
      localStorage.setItem("admin_passcode", password);
      setIsAdmin(true);
      setAdminPasscode(password);
      alert("🎉 欢迎回来，主理人！管理模式已启用。");
    } else if (password) {
      alert("❌ 密码错误");
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("admin_passcode");
    setIsAdmin(false);
    setAdminPasscode("");
    setIsFormCreator(false);
    setIsFormPinned(false);
    alert("已退出主理人管理模式");
  };

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
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAdmin && adminPasscode) {
        headers["Authorization"] = `Bearer ${adminPasscode}`;
      }

      const res = await fetch("/api/songs", {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          url, 
          title, 
          artist, 
          cover, 
          genre, 
          language, 
          comment, 
          platform,
          isCreator: isAdmin ? isFormCreator : false,
          isPinned: isAdmin ? isFormPinned : false
        }),
      });
      
      const result = await res.json();
      
      if (!res.ok || !result.success) {
        alert(`❌ 发布失败: ${result.error || "未知错误"}\n提示: 请检查是否在 Vercel 关联了 ADMIN_PASSWORD 环境变量并进行了 Redeploy。`);
        return;
      }

      // Reset form on success
      setUrl("");
      setTitle("");
      setArtist("");
      setCover("");
      setComment("");
      setIsFormCreator(false);
      setIsFormPinned(false);
      // Force mutate all SWR caches for this API
      mutate();
      // Optional: Give it a slight delay and mutate again to be absolutely sure
      setTimeout(() => mutate(), 500);
    } catch (e) {
      console.error(e);
      alert("❌ 网络请求错误，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这首歌曲吗？")) return;
    try {
      const res = await fetch(`/api/songs?id=${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${adminPasscode}`
        }
      });
      if (res.ok) {
        mutate();
      } else {
        alert("删除失败");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePin = async (id: string, currentPin: boolean) => {
    try {
      const res = await fetch(`/api/songs`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminPasscode}`
        },
        body: JSON.stringify({ id, isPinned: !currentPin })
      });
      if (res.ok) {
        mutate();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleCreator = async (id: string, currentCreator: boolean) => {
    try {
      const res = await fetch(`/api/songs`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminPasscode}`
        },
        body: JSON.stringify({ id, isCreator: !currentCreator })
      });
      if (res.ok) {
        mutate();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans pb-20">
      <header className="bg-white sticky top-0 z-10 border-b border-neutral-200 px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc3 className="w-6 h-6 text-indigo-600 animate-spin" style={{ animationDuration: '6s' }} />
            <h1 className="text-xl font-bold tracking-tight">打捞 (Dredge)</h1>
            <span className="text-sm text-neutral-500 ml-2 hidden sm:inline">每日好歌共享池</span>
          </div>
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold animate-pulse">
                <Crown className="w-3.5 h-3.5" />
                主理人模式已启用
              </span>
              <button 
                onClick={handleAdminLogout}
                className="text-xs px-2 py-1 text-neutral-400 hover:text-neutral-600 transition"
              >
                退出
              </button>
            </div>
          ) : (
            <button 
              onClick={handleAdminLogin}
              className="text-xs text-neutral-300 hover:text-neutral-400 flex items-center gap-1 transition"
              title="主理人后台"
            >
              <Lock className="w-3 h-3" />
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 mt-8 space-y-12">
        {/* Submit Section */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 relative overflow-hidden">
          {isAdmin && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
          )}
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

                {/* Creator Privileges Form Checkboxes */}
                {isAdmin && (
                  <div className="md:col-span-2 flex items-center gap-6 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                    <label className="flex items-center gap-2 text-sm font-semibold text-amber-800 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={isFormCreator} 
                        onChange={e => setIsFormCreator(e.target.checked)} 
                        className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer" 
                      />
                      👑 标记为主理人推荐
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-amber-800 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={isFormPinned} 
                        onChange={e => setIsFormPinned(e.target.checked)} 
                        className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer" 
                      />
                      📌 置顶这首歌
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button disabled={!title || submitting} type="submit" className={`px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-white ${
                isAdmin ? "bg-amber-600 hover:bg-amber-700 shadow-md" : "bg-indigo-600 hover:bg-indigo-700"
              }`}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isAdmin ? "作为主理人发布" : "分享到池子"}
              </button>
            </div>
          </form>
        </section>

        {/* Feed Section */}
        <section>
          {/* Section Header with Favorites Toggle */}
          <div className="flex justify-between items-center pb-4 mb-4 border-b border-neutral-200/60">
            <h2 className="text-xl font-bold text-neutral-800">发现好歌</h2>
            <button 
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                showFavoritesOnly 
                  ? "bg-red-500 text-white shadow-md shadow-red-100" 
                  : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <Heart className={`w-4 h-4 ${showFavoritesOnly ? "fill-white text-white" : "text-red-500"}`} />
              我的收藏 ({favorites.length})
            </button>
          </div>

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
            {data && (showFavoritesOnly ? favorites.length === 0 : data.data.length === 0) && (
              <div className="text-center text-neutral-400 py-12 bg-white rounded-2xl border border-neutral-100 shadow-sm">
                {showFavoritesOnly ? (
                  <div className="max-w-md mx-auto px-4">
                    <Heart className="w-10 h-10 mx-auto mb-3 text-red-400 opacity-40 animate-pulse" />
                    <p className="font-semibold text-neutral-700">你的收藏夹空空如也</p>
                    <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                      点按好歌下方的“❤️ 收藏”按钮，它们就会被收录在这里啦。
                      所有收藏都安全的保存在你自己的浏览器里。
                    </p>
                  </div>
                ) : (
                  <>
                    <Music className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>暂无符合条件的歌曲，快来投递第一首吧！</p>
                  </>
                )}
              </div>
            )}
            
            {(() => {
              if (!data?.data || data.data.length === 0) return null;
              
              // Filter songs if showFavoritesOnly is active
              const displaySongs = showFavoritesOnly 
                ? data.data.filter((song: any) => favorites.includes(song.id))
                : data.data;

              if (displaySongs.length === 0) return null;
              
              // Group songs by date
              const groupedSongs = displaySongs.reduce((acc: any, song: any) => {
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
                            className={`group block bg-white rounded-2xl p-4 shadow-sm border transition-all ${
                              song.isPinned 
                                ? "border-amber-300 ring-1 ring-amber-300/50 hover:shadow-amber-100/50" 
                                : "border-neutral-100 hover:shadow-md"
                            }`}
                          >
                            <div className="flex gap-4 items-start">
                              <div className="relative shrink-0">
                                <img 
                                  src={song.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=200&h=200"} 
                                  alt={song.title} 
                                  className="w-24 h-24 rounded-xl object-cover"
                                />
                                {song.isPinned && (
                                  <div className="absolute -top-1.5 -left-1.5 bg-amber-500 text-white p-1 rounded-full shadow" title="置顶歌曲">
                                    <Pin className="w-3.5 h-3.5 fill-white" />
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h3 className="font-semibold text-lg text-neutral-900 truncate">{song.title}</h3>
                                      {song.isCreator && (
                                        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium shrink-0">
                                          <Crown className="w-3 h-3" />
                                          主理人推荐
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-neutral-500 truncate">{song.artist}</p>
                                  </div>
                                  {song.platform === "netease" ? (
                                    <span className="text-xs px-2 py-1 bg-neutral-50 text-neutral-500 rounded-md shrink-0">来源: 网易云</span>
                                  ) : song.platform === "apple" ? (
                                    <span className="text-xs px-2 py-1 bg-neutral-50 text-neutral-500 rounded-md shrink-0">来源: Apple</span>
                                  ) : null}
                                </div>

                                {song.comment && (
                                  <p className={`mt-3 text-sm p-2.5 rounded-lg border line-clamp-2 ${
                                    song.isCreator 
                                      ? "text-amber-900 bg-amber-50/50 border-amber-100" 
                                      : "text-neutral-700 bg-neutral-50 border-neutral-100"
                                  }`}>
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
                                
                                {/* Action Buttons */}
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-neutral-100 pt-3">
                                  {/* Multi-platform jump buttons */}
                                  <div className="flex flex-wrap gap-2">
                                    <a 
                                      href={neteaseLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                                    >
                                      <Disc3 className="w-4 h-4 animate-spin-slow" />
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
                                    {/* 收藏按钮 */}
                                    <button 
                                      onClick={() => handleToggleFavorite(song.id)}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        favorites.includes(song.id)
                                          ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                                          : "bg-neutral-50 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                                      }`}
                                    >
                                      <Heart className={`w-3.5 h-3.5 ${favorites.includes(song.id) ? "fill-rose-500 text-rose-500" : ""}`} />
                                      {favorites.includes(song.id) ? "已收藏" : "收藏"}
                                    </button>
                                  </div>

                                  {/* Creator Management Actions */}
                                  {isAdmin && (
                                    <div className="flex items-center gap-1.5 bg-amber-50/50 p-1 rounded-lg border border-amber-200">
                                      <button
                                        onClick={() => handleTogglePin(song.id, song.isPinned)}
                                        className={`p-1.5 rounded transition ${
                                          song.isPinned ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-100"
                                        }`}
                                        title={song.isPinned ? "取消置顶" : "置顶歌曲"}
                                      >
                                        <Pin className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleToggleCreator(song.id, song.isCreator)}
                                        className={`p-1.5 rounded transition ${
                                          song.isCreator ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-100"
                                        }`}
                                        title={song.isCreator ? "取消主理人标记" : "标记为主理人推荐"}
                                      >
                                        <Crown className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(song.id)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                        title="删除歌曲"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
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

      {/* Subtle Footer for Passcode login */}
      <footer className="mt-20 border-t border-neutral-200/50 py-8 text-center text-xs text-neutral-400">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-2">
          <p>© 2026 打捞 (Dredge) · 倾听世界的温差</p>
          {!isAdmin ? (
            <button 
              onClick={handleAdminLogin}
              className="mt-1 flex items-center gap-1 text-neutral-300 hover:text-indigo-400 transition"
            >
              <Lock className="w-3 h-3" />
              主理人通道
            </button>
          ) : (
            <button 
              onClick={handleAdminLogout}
              className="mt-1 flex items-center gap-1 text-amber-500 hover:text-amber-600 transition font-semibold"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              主理人模式已启用 (点击退出)
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}
