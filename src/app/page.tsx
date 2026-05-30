"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format, isToday, isYesterday } from "date-fns";
import { Music, Send, Loader2, PlayCircle, Apple, Disc3, Calendar, Trash2, Pin, Crown, Heart, User, LogOut, X, Mail, Key, Smile } from "lucide-react";

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
  const [isFormCreator, setIsFormCreator] = useState(false);
  const [isFormPinned, setIsFormPinned] = useState(false);

  // User Authentication State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Favorites State
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Rating State
  const [hoverStars, setHoverStars] = useState<Record<string, number>>({});
  const [ratingSubmitting, setRatingSubmitting] = useState<Set<string>>(new Set());

  // Avatar Setup State
  const [showAvatarSetup, setShowAvatarSetup] = useState(false);
  const [avatarFile, setAvatarFile] = useState<string | null>(null);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropZoom, setCropZoom] = useState(1.5);
  const [cropDragging, setCropDragging] = useState(false);
  const [cropDragStart, setCropDragStart] = useState({ x: 0, y: 0 });
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Show avatar setup for new users without avatar
  useEffect(() => {
    if (isAuthenticated && currentUser && !currentUser.avatar) {
      const skipped = localStorage.getItem("dredge_avatar_skipped");
      if (!skipped) {
        setShowAvatarSetup(true);
      }
    }
  }, [isAuthenticated, currentUser]);

  const { data, mutate } = useSWR(`/api/songs?genre=${activeGenre}&language=${activeLanguage}`, fetcher, {
    revalidateOnFocus: true,
    revalidateOnMount: true
  });

  // Fetch user profile from SWR
  const { data: authData, mutate: mutateUser } = useSWR("/api/auth/me", fetcher);
  const currentUser = authData?.user;
  const isAuthenticated = authData?.authenticated;
  const isAdmin = currentUser?.email === "kimioldlee@gmail.com";

  // Leaderboard fetches
  const { data: topRecommendData } = useSWR("/api/songs?sort=recommendRate&limit=20&today=true", fetcher);
  const { data: topNicheData } = useSWR("/api/songs?sort=nicheCount&limit=20&today=true", fetcher);
  const topRecommend = topRecommendData?.data || [];
  const topNiche = topNicheData?.data || [];

  // Load favorites from localStorage on start
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

  // Sync and merge favorites when authenticated
  useEffect(() => {
    if (isAuthenticated && authData?.favorites) {
      const localFavs = localStorage.getItem("dredge_favorites");
      const localArr: string[] = localFavs ? JSON.parse(localFavs) : [];
      
      // Merge local and remote
      const merged = Array.from(new Set([...localArr, ...authData.favorites]));
      setFavorites(merged);
      localStorage.setItem("dredge_favorites", JSON.stringify(merged));
      
      // If there are newly added local favorites while offline, sync them to backend!
      const unsyncedFavs = localArr.filter(id => !authData.favorites.includes(id));
      if (unsyncedFavs.length > 0) {
        Promise.all(
          unsyncedFavs.map(songId => 
            fetch("/api/favorites", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ songId })
            }).catch(e => console.error(e))
          )
        ).then(() => {
          mutateUser();
        });
      }
    }
  }, [isAuthenticated, authData?.favorites, mutateUser]);

  const handleToggleFavorite = async (id: string) => {
    // 1. Optimistic update (instantly update local UI)
    let updatedFavorites;
    const isCurrentlyFav = favorites.includes(id);
    if (isCurrentlyFav) {
      updatedFavorites = favorites.filter(favId => favId !== id);
    } else {
      updatedFavorites = [...favorites, id];
    }
    setFavorites(updatedFavorites);
    localStorage.setItem("dredge_favorites", JSON.stringify(updatedFavorites));

    // 2. If logged in, sync to backend database
    if (isAuthenticated) {
      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId: id })
        });
        const result = await res.json();
        if (result.success && result.favorites) {
          setFavorites(result.favorites);
          localStorage.setItem("dredge_favorites", JSON.stringify(result.favorites));
          mutateUser();
        }
      } catch (e) {
        console.error("Failed to sync favorite with server:", e);
      }
    }
  };

  const handleRate = async (songId: string, value: number) => {
    if (!isAuthenticated) {
      setAuthTab("login");
      setAuthError("");
      setShowAuthModal(true);
      return;
    }

    setRatingSubmitting((prev) => new Set(prev).add(songId));
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, value }),
      });
      const result = await res.json();
      if (result.success) {
        // Refresh song list to get updated averages
        mutate();
      }
    } catch (e) {
      console.error("Failed to submit rating:", e);
    } finally {
      setRatingSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(songId);
        return next;
      });
    }
  };

  const handleReview = async (songId: string, field: "recommended" | "mainstream", value: boolean) => {
    if (!isAuthenticated) {
      setAuthTab("login");
      setAuthError("");
      setShowAuthModal(true);
      return;
    }

    try {
      const body: any = { songId };
      body[field] = value;
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      mutate();
    } catch (e) {
      console.error("Failed to submit review:", e);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarFile(url);
    setCropX(0);
    setCropY(0);
    setCropZoom(1.5);
    e.target.value = "";
  };

  const handleCropConfirm = async () => {
    if (!avatarFile) return;
    setAvatarUploading(true);
    const img = new window.Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const size = 150;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const srcSize = Math.max(img.width, img.height) * cropZoom;
      const sx = (img.width - srcSize / cropZoom) / 2 + cropX / cropZoom;
      const sy = (img.height - srcSize / cropZoom) / 2 + cropY / cropZoom;
      ctx.drawImage(img, sx, sy, srcSize / cropZoom, srcSize / cropZoom, 0, 0, size, size);
      const base64 = canvas.toDataURL("image/jpeg", 0.85);
      try {
        const res = await fetch("/api/auth/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: base64 }),
        });
        if (res.ok) {
          mutateUser();
          setShowAvatarSetup(false);
          setAvatarFile(null);
        }
      } catch (err) {
        console.error(err);
      }
      setAvatarUploading(false);
    };
    img.src = avatarFile;
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSubmitting(true);

    const isLogin = authTab === "login";
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin 
      ? { email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword, name: authName };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setAuthError(result.error || "操作失败，请重试");
        return;
      }

      // Close modal & reset fields
      setShowAuthModal(false);
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
      // Update user state
      mutateUser();
      alert(isLogin ? `👋 欢迎回来，${result.data.name}！` : `🎉 注册成功！已为您自动登录，欢迎来到打捞。`);
    } catch (e) {
      console.error(e);
      setAuthError("网络请求错误，请稍后再试");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("确定要退出登录吗？")) return;
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        mutateUser();
        // Clear local cache if they want, but keeping favorites locally is nice and graceful.
        // Actually, just let mutateUser clear the authenticated state is perfect!
        alert("已成功退出登录");
      }
    } catch (e) {
      console.error(e);
    }
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
        alert(`❌ 发布失败: ${result.error || "未知错误"}`);
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
      <header className="bg-white sticky top-0 z-20 border-b border-neutral-200 px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Disc3 className="w-6 h-6 text-indigo-600 animate-spin shrink-0" style={{ animationDuration: '6s' }} />
            <h1 className="text-xl font-bold tracking-tight shrink-0">打捞 (Dredge)</h1>
            <span className="text-sm text-neutral-500 ml-2 hidden sm:inline truncate">每日好歌共享池</span>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            {/* User Session Interface */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <label className="cursor-pointer" title="点击设置头像" onClick={(e) => { e.preventDefault(); setShowAvatarSetup(true); }}>
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-6 h-6 rounded-full object-cover border border-indigo-200" />
                  ) : (
                    <Disc3 className="w-6 h-6 text-indigo-600" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                  {currentUser.name}
                </span>
                <button 
                  onClick={handleLogout}
                  className="text-xs text-neutral-400 hover:text-red-500 transition-colors"
                  title="退出账户登录"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setAuthTab("login");
                  setAuthError("");
                  setShowAuthModal(true);
                }}
                className="text-xs px-2.5 py-1.5 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-600 border border-neutral-200/60 rounded-lg font-medium transition-all"
              >
                登录 / 注册
              </button>
            )}

            {/* Admin Indicator */}
            <div className="border-l border-neutral-200 pl-3 flex items-center">
              {isAdmin && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold">
                  <Crown className="w-3 h-3" />
                  主理人
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Leaderboards */}
      <div className="max-w-3xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recommend Rate TOP 20 */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                🔥 推荐率 TOP 20
              </h3>
            </div>
            <div className="divide-y divide-neutral-50 max-h-80 overflow-y-auto">
              {topRecommend.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-6">今日还没有推荐数据</p>
              ) : (
                topRecommend.map((song: any, idx: number) => (
                  <a
                    key={song.id}
                    href={song.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/50 transition-colors group"
                  >
                    <span className={`text-xs font-bold w-5 shrink-0 ${
                      idx < 3 ? "text-amber-500" : "text-neutral-400"
                    }`}>
                      {idx + 1}
                    </span>
                    <img
                      src={song.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=80&h=80"}
                      alt={song.title}
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800 truncate">{song.title}</p>
                      <p className="text-xs text-neutral-400 truncate">{song.artist}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-600 shrink-0">{song.recommendRate}%</span>
                  </a>
                ))
              )}
            </div>
          </div>

          {/* Niche TOP 20 */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100">
              <h3 className="text-sm font-bold text-violet-800 flex items-center gap-1.5">
                💎 小众发现 TOP 20
              </h3>
            </div>
            <div className="divide-y divide-neutral-50 max-h-80 overflow-y-auto">
              {topNiche.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-6">今日还没有小众标记</p>
              ) : (
                topNiche.map((song: any, idx: number) => (
                  <a
                    key={song.id}
                    href={song.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50/50 transition-colors group"
                  >
                    <span className={`text-xs font-bold w-5 shrink-0 ${
                      idx < 3 ? "text-violet-500" : "text-neutral-400"
                    }`}>
                      {idx + 1}
                    </span>
                    <img
                      src={song.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=80&h=80"}
                      alt={song.title}
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800 truncate">{song.title}</p>
                      <p className="text-xs text-neutral-400 truncate">{song.artist}</p>
                    </div>
                    <span className="text-xs font-bold text-violet-600 shrink-0">{song.nicheCount}人</span>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-4 space-y-12">
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
                                      {song.user?.name && (
                                        <span className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded font-medium shrink-0">
                                          {song.user.avatar ? (
                                            <img src={song.user.avatar} alt={song.user.name} className="w-3.5 h-3.5 rounded-full object-cover" />
                                          ) : (
                                            <Disc3 className="w-3.5 h-3.5 text-indigo-600" />
                                          )}
                                          投递人: {song.user.name}
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

                                {/* Star Rating */}
                                <div className="mt-2.5 flex items-center gap-1.5">
                                  <div className="flex items-center gap-px"
                                    onMouseLeave={() => setHoverStars((prev) => {
                                      const next = { ...prev };
                                      delete next[song.id];
                                      return next;
                                    })}
                                  >
                                    {[0, 1, 2, 3, 4].map((i) => {
                                      const hoverVal = hoverStars[song.id];
                                      const displayVal = hoverVal ?? (song.averageRating || 0);
                                      const leftHalf = i + 0.5;
                                      const fullStar = i + 1;
                                      const fillPct = displayVal >= fullStar ? 100 : displayVal >= leftHalf ? 50 : 0;
                                      return (
                                        <div
                                          key={i}
                                          className="relative w-5 h-5 cursor-pointer"
                                          style={{ fontSize: '17px', lineHeight: '20px' }}
                                          onMouseMove={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const x = e.clientX - rect.left;
                                            const half = x < rect.width / 2;
                                            setHoverStars((prev) => ({ ...prev, [song.id]: half ? leftHalf : fullStar }));
                                          }}
                                        >
                                          <span className="absolute inset-0 text-neutral-300 select-none">★</span>
                                          <span
                                            className="absolute inset-0 overflow-hidden text-amber-500 select-none transition-all duration-75"
                                            style={{ width: `${fillPct}%` }}
                                          >
                                            ★
                                          </span>
                                          {/* Click zones: left half */}
                                          <span
                                            className="absolute left-0 top-0 w-1/2 h-full z-10"
                                            onClick={() => handleRate(song.id, leftHalf)}
                                          />
                                          {/* Click zones: right half */}
                                          <span
                                            className="absolute right-0 top-0 w-1/2 h-full z-10"
                                            onClick={() => handleRate(song.id, fullStar)}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {(song.ratingCount > 0 || ratingSubmitting.has(song.id)) && (
                                    <span className="text-xs text-amber-600 font-medium">
                                      {ratingSubmitting.has(song.id) ? (
                                        <Loader2 className="w-3 h-3 animate-spin inline" />
                                      ) : (
                                        <>{song.averageRating} <span className="text-neutral-400 font-normal">({song.ratingCount})</span></>
                                      )}
                                    </span>
                                  )}
                                  {!isAuthenticated && (
                                    <span className="text-[10px] text-neutral-400">登录后可评分</span>
                                  )}
                                </div>

                                {/* Review Widget: 推荐 + 大众/小众 */}
                                <div className="mt-2 flex items-center gap-3">
                                  {/* Recommend toggle */}
                                  <button
                                    onClick={() => handleReview(song.id, "recommended", true)}
                                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                                      song.userReview?.recommended
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                        : "bg-neutral-50 text-neutral-400 border border-neutral-200/60 hover:bg-emerald-50 hover:text-emerald-600"
                                    }`}
                                  >
                                    👍 推荐
                                    {song.recommendCount > 0 && (
                                      <span className="text-[10px] opacity-70">{song.recommendCount}</span>
                                    )}
                                  </button>
                                  {song.totalReviewCount > 0 && (
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                      (song.recommendRate ?? 0) >= 80 ? "bg-emerald-100 text-emerald-700" :
                                      (song.recommendRate ?? 0) >= 50 ? "bg-amber-100 text-amber-700" :
                                      "bg-neutral-100 text-neutral-500"
                                    }`}>
                                      {(song.recommendRate ?? 0)}%
                                    </span>
                                  )}

                                  {/* Niche toggle */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleReview(song.id, "mainstream", song.userReview?.mainstream === false ? true : false)}
                                      className={`text-xs px-2 py-1 rounded-full font-medium transition-all ${
                                        song.userReview?.mainstream === false
                                          ? "bg-violet-100 text-violet-700 border border-violet-200"
                                          : "bg-neutral-50 text-neutral-400 border border-neutral-200/60 hover:bg-violet-50 hover:text-violet-600"
                                      }`}
                                    >
                                      💎 小众
                                      {song.nicheCount > 0 && (
                                        <span className="ml-0.5 text-[10px] opacity-70">{song.nicheCount}</span>
                                      )}
                                    </button>
                                  </div>
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

      {/* Footer */}
      <footer className="mt-20 border-t border-neutral-200/50 py-8 text-center text-xs text-neutral-400">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-2">
          <p>© 2026 打捞 (Dredge) · 倾听世界的温差</p>
        </div>
      </footer>

      {/* User Login/Register Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowAuthModal(false);
                setAuthError("");
              }}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Tabs */}
            <div className="flex border-b border-neutral-100 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthTab("login");
                  setAuthError("");
                }}
                className={`flex-1 pb-3 text-center font-semibold text-sm transition-colors ${
                  authTab === "login"
                    ? "border-b-2 border-indigo-600 text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                登录账号
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab("register");
                  setAuthError("");
                }}
                className={`flex-1 pb-3 text-center font-semibold text-sm transition-colors ${
                  authTab === "register"
                    ? "border-b-2 border-indigo-600 text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                注册新账号
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authTab === "register" && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                    起个好听的昵称
                  </label>
                  <div className="relative">
                    <Smile className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="例如: 听歌的小李"
                      className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  电子邮箱
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  密码
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="输入至少 6 位密码..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                </div>
              </div>

              {authError && (
                <p className="text-xs text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100">
                  ⚠️ {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-6"
              >
                {authSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {authTab === "login" ? "登录" : "注册并登录"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Avatar Setup Modal */}
      {showAvatarSetup && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative">
            <button
              onClick={() => {
                localStorage.setItem("dredge_avatar_skipped", "1");
                setShowAvatarSetup(false);
                setAvatarFile(null);
              }}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-neutral-800 mb-1">设置你的头像</h3>
            <p className="text-sm text-neutral-400 mb-6">让大家在歌曲卡片上认出你</p>

            {!avatarFile ? (
              <div className="space-y-3">
                {/* Default avatar option */}
                <button
                  onClick={() => {
                    localStorage.setItem("dredge_avatar_skipped", "1");
                    setShowAvatarSetup(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                >
                  <div className="w-14 h-14 rounded-full bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Disc3 className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-neutral-800 text-sm">使用默认头像</p>
                    <p className="text-xs text-neutral-400">蓝色打捞碟片，和标签页一样</p>
                  </div>
                </button>

                {/* Custom avatar option */}
                <label className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group">
                  <div className="w-14 h-14 rounded-full bg-indigo-50 border-2 border-dashed border-indigo-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Smile className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-neutral-800 text-sm">上传自定义头像</p>
                    <p className="text-xs text-neutral-400">选择照片并裁剪区域</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Crop area */}
                <div className="relative mx-auto w-52 h-52 rounded-full overflow-hidden bg-neutral-900 select-none"
                  onMouseDown={(e) => { setCropDragging(true); setCropDragStart({ x: e.clientX - cropX, y: e.clientY - cropY }); }}
                  onMouseMove={(e) => { if (cropDragging) { setCropX(e.clientX - cropDragStart.x); setCropY(e.clientY - cropDragStart.y); } }}
                  onMouseUp={() => setCropDragging(false)}
                  onMouseLeave={() => setCropDragging(false)}
                  onTouchStart={(e) => { const t = e.touches[0]; setCropDragging(true); setCropDragStart({ x: t.clientX - cropX, y: t.clientY - cropY }); }}
                  onTouchMove={(e) => { if (cropDragging) { const t = e.touches[0]; setCropX(t.clientX - cropDragStart.x); setCropY(t.clientY - cropDragStart.y); } }}
                  onTouchEnd={() => setCropDragging(false)}
                >
                  <img
                    src={avatarFile}
                    alt="裁剪预览"
                    className="absolute max-w-none"
                    style={{
                      width: `${208 * cropZoom}px`,
                      height: `${208 * cropZoom}px`,
                      left: `calc(50% - ${104 * cropZoom}px + ${cropX}px)`,
                      top: `calc(50% - ${104 * cropZoom}px + ${cropY}px)`,
                    }}
                    draggable={false}
                  />
                  {/* Circular overlay border */}
                  <div className="absolute inset-0 rounded-full border-2 border-white/60 pointer-events-none shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.15)]" />
                </div>

                {/* Zoom */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400">缩放</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={cropZoom}
                    onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-indigo-600"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setAvatarFile(null)}
                    className="flex-1 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700 border border-neutral-200 rounded-lg"
                  >
                    重选照片
                  </button>
                  <button
                    onClick={handleCropConfirm}
                    disabled={avatarUploading}
                    className="flex-1 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg flex items-center justify-center gap-1.5"
                  >
                    {avatarUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                    确认使用
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
