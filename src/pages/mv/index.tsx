import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    requireNativeComponent,
    BackHandler,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { WebView } from "react-native-webview";
import Icon from "@/components/base/icon.tsx";
import { TvFocusable } from "@/tv/components";
import { useTvKeys } from "@/tv/provider";
import { tvVideo } from "@/tv/bridge";
import { tvFocus } from "@/tv/focusStore";
import { showQrInput } from "@/tv/qrOverlay";
import TrackPlayer, { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import pluginManager from "@/core/pluginManager";
import rpx from "@/utils/rpx";

const TvVideoView = requireNativeComponent<any>("TvVideoView");

const SEEK_STEP = 15;
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const VIDEO_PATTERN = /\.(mp4|m3u8|flv|mkv|webm|ts|mov)(\?|#|$)/i;
const WEB_UA =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type TVideoSource =
    | {
          kind: "native";
          url: string;
          headers?: Record<string, string>;
          provider?: string;
          pageUrl?: string;
      }
    | { kind: "web"; pageUrl: string; title?: string };

function formatTime(value: number) {
    const seconds = Math.max(0, Math.floor(value / 1000));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/**
 * MV 视频播放页（电视全屏版）。
 *
 * 两种播放形态：
 * - native：插件给到 mp4/m3u8 直链（网易云 MVP、B 站签名流），用原生 TextureView 播放，能力最全；
 * - web：插件只给到网页地址（B 站搬运播放页兜底），用内嵌 WebView 播放，不需要任何签名。
 */
export default function MvPlayer() {
    const currentMusic = useCurrentMusic();
    const musicState = useMusicState();
    const [video, setVideo] = useState<TVideoSource | null>(null);
    const [paused, setPaused] = useState(false);
    const [hud, setHud] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [status, setStatus] = useState<{
        position: number;
        duration: number;
        hasAudio?: boolean;
        audioFormat?: string;
        streamVolume?: number;
        audioTracks?: number;
        videoTracks?: number;
        trackReadable?: boolean;
    }>({ position: 0, duration: 0 });
    // 音轨来源：video=用视频流自带的音轨，song=视频静音 + 歌曲音轨跟上画面
    const [audioMode, setAudioMode] = useState<"video" | "song">("video");
    const audioModeRef = useRef<"video" | "song">("video");
    const autoSongRef = useRef(false);
    // 内嵌网页（B 站播放页）同样没声：页面静音，改用歌曲音轨
    const webSongRef = useRef(false);
    const posRef = useRef(0);
    const [diagVisible, setDiagVisible] = useState(false);
    const [hint, setHint] = useState("");
    // HUD 内部选择位置：-1 表示停在进度条，0~3 表示四个图标
    const [hudIndex, setHudIndex] = useState(1);
    const hudIndexRef = useRef(1);
    const [loading, setLoading] = useState(false);
    const [webLoading, setWebLoading] = useState(false);
    // 先让原生视频视图真正挂到窗口上，再给它地址。
    // 之前是一挂载就 setVideo，textureView 还没建好，MediaPlayer 拿不到 surface → 首次进来一片黑
    const [surfaceReady, setSurfaceReady] = useState(false);
    const reopenCountRef = useRef<number>(0);
    // 画面起播计时从这里算（不是从进页面算）：解析慢的时候，之前用进页面时间
    // 判断“首帧没出来”，源刚给上就被判超时、立刻重建，反而一直黑屏
    const videoSetTsRef = useRef<number>(0);
    const reopenBusyRef = useRef(false);
    const aliveRef = useRef(true);
    // 第几次换源：这条没音轨/解不了时，让插件换下一个候选稿件
    const attemptRef = useRef(0);
    useEffect(() => {
        const t = setTimeout(() => setSurfaceReady(true), 420);
        return () => clearTimeout(t);
    }, []);
    const webRef = useRef<any>(null);
    const videoRef = useRef<TVideoSource | null>(null);
    const pausedRef = useRef(false);
    const hudRef = useRef(false);
    const wasPlayingRef = useRef(false);
    const songPausedByMvRef = useRef(false);
    const currentTitleRef = useRef<string | undefined>(undefined);
    const currentMusicRef = useRef<any>(null);

    videoRef.current = video;
    pausedRef.current = paused;
    hudRef.current = hud;
    hudIndexRef.current = hudIndex;

    currentTitleRef.current =
        (currentMusic as any)?.title ?? currentTitleRef.current;
    currentMusicRef.current = currentMusic;
    const applyResult = useCallback((result: any) => {
        if (result?.url) {
            setVideo({
                kind: "native",
                url: result.url,
                headers: result.headers,
                provider: result.provider,
                pageUrl:
                    result.pageUrl ??
                    (result.bvid
                        ? `https://player.bilibili.com/player.html?bvid=${result.bvid}&autoplay=true&danmaku=0&high_quality=1`
                        : undefined),
            });
        } else if (result?.pageUrl) {
            setVideo({
                kind: "web",
                pageUrl: result.pageUrl,
                title: result.title,
            });
        }
        setPaused(false);
        setHint("");
        setLoading(false);
    }, []);

    /** 单次尝试：向插件要 MV 地址 */
    const tryResolveOnce = useCallback(async (music: any, opts?: any) => {
        const plugin = pluginManager.getByMedia(music);
        if (!plugin) {
            throw new Error("当前歌曲的音源插件未启用");
        }
        const hasMv = (plugin as any).supportedMethods?.has?.("getMusicVideo");
        if (!hasMv) {
            return null;
        }
        const mvResult = await Promise.race([
            (plugin as any).methods?.getMusicVideo?.(music, opts),
            new Promise((_resolve, reject) =>
                setTimeout(() => reject(new Error("解析超时（30 秒）")), 30000),
            ),
        ]);
        if ((mvResult as any)?.url || (mvResult as any)?.pageUrl) {
            return mvResult as any;
        }
        return null;
    }, []);

    /** 从当前音源插件解析视频地址 */
    const resolveFromPlugin = useCallback(
        async (music: any, opts?: { next?: boolean }) => {
            if (opts?.next) {
                attemptRef.current += 1;
            }
            const pluginOpts = {
                attempt: attemptRef.current,
                noCache: attemptRef.current > 0,
            };
            if (!music) {
                setHint("当前没有正在播放的歌曲");
                return;
            }
            setLoading(true);
            setHint("正在解析 MV…");
            let lastErr: any = null;
            // 第一次经常卡在插件侧的网络抖动（尤其 B 站要现取 cookie），
            // 静默重试一次再报错，避免“明明有 MV 却提示没有”
            for (let i = 0; i < 2; i += 1) {
                if (!aliveRef.current) {
                    return;
                }
                if (i > 0) {
                    setHint("第一次没拿到，正在重试解析…");
                    await new Promise(resolve => setTimeout(resolve, 900));
                    if (!aliveRef.current) {
                        return;
                    }
                }
                try {
                    const mvResult = await tryResolveOnce(music, pluginOpts);
                    if (mvResult) {
                        applyResult(mvResult);
                        return;
                    }
                    lastErr = new Error("插件没匹配到这支 MV");
                } catch (e: any) {
                    lastErr = e;
                }
            }
            if (!aliveRef.current) {
                return;
            }
            // 插件没给 MV：退回“音源直链是不是就是视频”
            try {
                const plugin = pluginManager.getByMedia(music);
                const result = await (plugin as any)?.methods?.getMediaSource?.(
                    music,
                    "super",
                );
                const url = result?.url ?? "";
                if (url && VIDEO_PATTERN.test(url)) {
                    applyResult({ url });
                    return;
                }
            } catch {}
            setLoading(false);
            setHint(
                `没有拿到《${music.title ?? ""}》的 MV：${
                    lastErr?.message ?? "插件没匹配到"
                }（按 OK 可再试一次）`,
            );
        },
        [applyResult],
    );

    // 进入页面：记录歌曲状态、挂起焦点系统
    useEffect(() => {
        aliveRef.current = true;
        attemptRef.current = 0;
        autoSongRef.current = false;
        setAudioMode("video");
        audioModeRef.current = "video";
        wasPlayingRef.current = !musicIsPaused(musicState);
        tvFocus.suspendFocus();
        resolveFromPlugin(currentMusic);
        return () => {
            aliveRef.current = false;
            TrackPlayer.setVolume(1);
            try {
                tvVideo.stop();
            } catch {}
            try {
                webRef.current?.stopLoading?.();
                injectWeb("try{v.pause()}catch(e){}");
            } catch {}
            tvFocus.resumeFocus();
            if (songPausedByMvRef.current && wasPlayingRef.current) {
                TrackPlayer.play();
                songPausedByMvRef.current = false;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 视频开播后暂停后台歌曲，退出 MV 时再还回去
    useEffect(() => {
        if (!video) {
            return;
        }
        // 用歌曲音轨出声时不暂停它，否则没声音
        if (audioModeRef.current === "song") {
            return;
        }
        if (!musicIsPaused(musicState)) {
            TrackPlayer.pause();
            songPausedByMvRef.current = true;
        }
        // 不管歌曲是不是已经在暂停，都把它的音量压到 0：
        // 有些盒子只要还有另一个播放器挂在音频路上，MediaPlayer 就出不来声
        TrackPlayer.setVolume(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [video]);

    // 歌曲音轨模式：视频静音，声音交给**独立原生配乐播放器**放出这首歌的音源。
    // 不再借用 App 内的歌曲播放器（它会被别的播放器抢焦点自动暂停 = 响一秒就没声）
    useEffect(() => {
        if (!video || audioMode !== "song") {
            return;
        }
        let stopped = false;
        (async () => {
            try {
                // 优先用 B 站 dash 的音频流：和画面同源，快进快退/倍速才对得上
                const cur = videoRef.current;
                let audioUrl =
                    cur?.kind === "native" ? cur.audioUrl ?? "" : "";
                let audioHeaders = cur?.headers;

                // 三级策略：B站音轨（最同步）→ 视频自带音轨（同一条流，天然同步）
                // → 实在只有画面，才用歌曲音源出声（并明确提示可能不同步）
                if (!audioUrl) {
                    // 等原生把流探清楚（没 ready 时 audioTracks 可能还是空的，会误判成"没音轨"）
                    let st: any = null;
                    for (let i = 0; i < 4; i += 1) {
                        st = await tvVideo.getStatus().catch(() => null);
                        if (st?.ready) {
                            break;
                        }
                        await new Promise(r => setTimeout(r, 350));
                    }
                    const hasOwnTrack =
                        !!st && st.ready === true && (st.audioTracks ?? 0) > 0;
                    if (cur?.kind === "native" && hasOwnTrack) {
                        if (!stopped) {
                            setHint("这条视频自带音轨，用画面原音出声");
                            setTimeout(() => setHint(""), 3000);
                            setAudioMode("video");
                            audioModeRef.current = "video";
                        }
                        return;
                    }
                    // 纯画面（B站 dash 分轨或网页兜底）：拿歌曲音源顶上，至少要有声
                    const music = currentMusicRef.current;
                    if (!music) {
                        return;
                    }
                    const plugin = pluginManager.getByMedia(music);
                    const src: any = await plugin?.methods?.getMediaSource?.(
                        music,
                        "super",
                    );
                    if (stopped || !src?.url) {
                        return;
                    }
                    audioUrl = src.url;
                    audioHeaders = src.headers;
                    if (!stopped) {
                        setHint(
                            "这条视频只有画面，已用歌曲音源出声（快进后可能不同步）",
                        );
                        setTimeout(() => setHint(""), 5000);
                    }
                }
                await tvVideo.setMvAudio(audioUrl, audioHeaders);
                await tvVideo.mvAudioSeek(posRef.current || 0);
                await tvVideo.mvAudioPlay();
            } catch {}
        })();
        let fallbackTried = false;
        let ticks = 0;
        const timer = setInterval(() => {
            if (!aliveRef.current || audioModeRef.current !== "song") {
                return;
            }
            (async () => {
                try {
                    const st: any = await tvVideo.getMvAudioStatus();
                    ticks += 1;
                    // B 站音频流在这个盒子上解不出来时，不要再退回歌曲音源
                    // （那是另一份录音，音画必然错位），直接改用视频原音：
                    // 同一条流里的音和画，从根上就是同步的。
                    if (!fallbackTried && (st?.audioError || (!st?.ready && ticks >= 6))) {
                        fallbackTried = true;
                        setHint("B站音轨在本机解不出来，已切到视频原音");
                        setTimeout(() => setHint(""), 3500);
                        setAudioMode("video");
                        audioModeRef.current = "video";
                        return;
                    }
                    if (!st?.ready) {
                        return;
                    }
                    if (!st.playing && !pausedRef.current) {
                        tvVideo.mvAudioPlay();
                    }
                    // 音画同步校准：以前 2 秒一查、差 0.9 秒才纠，用户能明显听出
                    // “口型和声音错半句”。改成 700ms 一查、差 150ms 就纠。
                    if (Math.abs((st.position ?? 0) - posRef.current) > 150) {
                        tvVideo.mvAudioSeek(posRef.current);
                    }
                } catch {}
            })();
        }, 700);
        return () => {
            stopped = true;
            clearInterval(timer);
            if (!aliveRef.current) {
                try {
                    tvVideo.mvAudioStop();
                } catch {}
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioMode, video]);

    // 换源/起播计时：每次拿到新画面都从这一刻开始算卡顿
    useEffect(() => {
        if (video) {
            videoSetTsRef.current = Date.now();
            reopenBusyRef.current = false;
            if (video.kind === "web") {
                const isBiliPage = /bilibili|b23\.tv/.test(video.pageUrl);
                webSongRef.current = isBiliPage;
                setAudioMode(isBiliPage ? "song" : "video");
                audioModeRef.current = isBiliPage ? "song" : "video";
            } else if (video.kind === "native") {
                webSongRef.current = false;
                // B 站这一路在盒子上从来没出过声（原生/内嵌都一样），默认直接用歌曲音轨，
                // 保证「点开 MV 就有声音」；想要 UP 主原声可按 HUD 第 5 个按钮切回
                const isBili = String((video as any).provider ?? "").indexOf("bili") >= 0;
                // 关键：只有真的拿到 B 站自己的音轨（dash 的 audioUrl）才用独立配乐播放器。
                // 拿不到就老老实实用视频原音 —— 视频自带音轨时是同一个播放器，天然同步；
                // 以前这里无条件用"歌曲音轨"，等于把录音室 mp3 配在演唱会画面上，
                // 内容都不同源，怎么校时都不可能对上。
                const hasOwnAudio = !!(video as any).audioUrl;
                const useSong = isBili && hasOwnAudio;
                setAudioMode(useSong ? "song" : "video");
                audioModeRef.current = useSong ? "song" : "video";
                autoSongRef.current = useSong;
                if (useSong) {
                    setHint("已用B站自己的音轨出声（HUD 内可切回视频原音）");
                    setTimeout(() => setHint(""), 4000);
                } else if (isBili) {
                    setHint("这条B站视频没有可用音轨，先用画面原音播放");
                    setTimeout(() => setHint(""), 4000);
                }
                setDiagVisible(true);
                const t = setTimeout(() => setDiagVisible(false), 20000);
                return () => clearTimeout(t);
            }
        }
        return undefined;
    }, [video]);

    // 没有 B 站音轨时先探画面流：确认它自己带不带音轨。
    // 带 → 用画面原音（同一条流，天然同步）；不带 → 只能用歌曲音源出声，并如实提示不同步。
    useEffect(() => {
        if (!video || video.kind !== "native" || (video as any).audioUrl) {
            return undefined;
        }
        let cancelled = false;
        (async () => {
            for (let i = 0; i < 6; i += 1) {
                if (cancelled) {
                    return;
                }
                const st: any = await tvVideo.getStatus().catch(() => null);
                if (st?.ready) {
                    if (
                        !cancelled &&
                        (st.audioTracks ?? 0) === 0 &&
                        audioModeRef.current === "video" &&
                        !autoSongRef.current
                    ) {
                        autoSongRef.current = true;
                        audioModeRef.current = "song";
                        setAudioMode("song");
                        setHint(
                            "这条视频画面没带音轨，已改用歌曲音源出声（快进后可能不同步）",
                        );
                        setTimeout(() => setHint(""), 5000);
                    }
                    return;
                }
                await new Promise(r => setTimeout(r, 400));
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [video]);

    // 进度轮询（只对原生播放有效）
    useEffect(() => {
        const timer = setInterval(async () => {
            if (videoRef.current?.kind !== "native") {
                return;
            }
            const result = await tvVideo.getStatus();
            if (!result || !aliveRef.current) {
                return;
            }
            if (result.error) {
                // 原生解码不了（B 站部分稿件 code=-38）：直接切内嵌播放页
                const current = videoRef.current;
                const webUrl =
                    current?.kind === "native" ? current.pageUrl : "";
                if (webUrl) {
                    setVideo({
                        kind: "web",
                        pageUrl: webUrl,
                        title: currentTitleRef.current,
                    });
                    setHint("这条 MV 解码失败，已切到内嵌播放");
                } else {
                    setHint(`${result.error}（按 OK 可再解析一次）`);
                }
                return;
            }
            posRef.current = result.position ?? 0;
            setStatus({
                position: result.position ?? 0,
                duration: result.duration ?? 0,
                hasAudio: (result as any).hasAudio,
                audioFormat: (result as any).audioFormat,
                streamVolume: (result as any).streamVolume,
                audioTracks: (result as any).audioTracks,
                videoTracks: (result as any).videoTracks,
                trackReadable: (result as any).trackReadable,
            });
            // 画面流里没有音轨（B 站 dash 纯画面 / UP 主静音版）：不再去换源碰运气，
            // 直接把视频静音、用歌曲自己的音轨出声 —— 歌曲播放这条路是确定能出声的
            if (
                (result as any).trackReadable === true &&
                (result as any).audioTracks === 0 &&
                (result.duration ?? 0) > 0 &&
                (result.position ?? 0) > 1200 &&
                !autoSongRef.current &&
                audioModeRef.current === "video"
            ) {
                autoSongRef.current = true;
                audioModeRef.current = "song";
                setAudioMode("song");
                setHint("这条 MV 画面没带音轨，已改用歌曲音轨出声（HUD 里可切回视频原音）");
                setTimeout(() => setHint(""), 4000);
                return;
            }
            const stalled = (result.position ?? 0) < 0.3;
            const age = Date.now() - videoSetTsRef.current;
            if (!video) {
                return;
            }
            // 起播后 7 秒还没任何进度：把播放器重建一次（第一次握手/CDN 节点失败很常见）
            if (stalled && age > 7000 && !reopenBusyRef.current) {
                const cur = videoRef.current;
                if (!cur || cur.kind !== "native") {
                    return;
                }
                if (reopenCountRef.current < 2) {
                    reopenCountRef.current += 1;
                    reopenBusyRef.current = true;
                    try {
                        tvVideo.stop();
                    } catch {}
                    setVideo(null);
                    setHint(
                        `画面没有出来，正在重新加载（第 ${reopenCountRef.current} 次）…`,
                    );
                    setTimeout(() => {
                        if (!aliveRef.current) {
                            return;
                        }
                        setVideo({ ...cur });
                    }, 1200);
                    return;
                }
                // 重建两次还是黑的：有网页地址就切内嵌，没有就让用户重试
                if (cur.pageUrl) {
                    setVideo({
                        kind: "web",
                        pageUrl: cur.pageUrl,
                        title: currentTitleRef.current,
                    });
                    setHint("这条 MV 的画面一直没出来，已切到内嵌播放");
                } else {
                    setHint("这条 MV 的画面一直没出来，按 OK 可重新解析");
                }
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [video]);

    const doPlay = useCallback(() => {
        tvVideo.play();
        setPaused(false);
        if (audioModeRef.current === "song") {
            try {
                tvVideo.mvAudioPlay();
            } catch {}
        }
    }, []);

    const doPause = useCallback(() => {
        tvVideo.pause();
        setPaused(true);
        if (audioModeRef.current === "song") {
            try {
                tvVideo.mvAudioPause();
            } catch {}
        }
    }, []);

    /** 音轨切换：视频原音 ⇄ 歌曲音轨 */
    const toggleAudioMode = useCallback(() => {
        setAudioMode(prev => {
            const next = prev === "song" ? "video" : "song";
            audioModeRef.current = next;
            if (next === "song") {
                // 原生配乐播放器由 [audioMode] effect 负责装载音源
                setHint("已切到歌曲音轨（正在装载歌曲音源）");
            } else {
                try {
                    tvVideo.mvAudioStop();
                } catch {}
                setHint("已切回视频原音");
            }
            setTimeout(() => setHint(""), 2500);
            return next;
        });
    }, []);

    const lastSeekTsRef = useRef(0);
    /** 连发（长按）时用小步进，单次按下用 15 秒 */
    const nextSeekStep = useCallback(() => {
        const now = Date.now();
        const rapid = now - lastSeekTsRef.current < 400;
        lastSeekTsRef.current = now;
        return rapid ? 5 : SEEK_STEP;
    }, []);

    const seekBy = useCallback(
        (deltaSeconds: number) => {
            if (videoRef.current?.kind !== "native") {
                return;
            }
            const duration = status.duration || 0;
            let target = Math.max(0, status.position + deltaSeconds * 1000);
            if (duration > 0) {
                target = Math.min(duration - 500, target);
            }
            tvVideo.seekTo(target);
            posRef.current = target;
            if (audioModeRef.current === "song") {
                try {
                    tvVideo.mvAudioSeek(target);
                } catch {}
            }
            setStatus(prev => ({ ...prev, position: target }));
            setHud(true);
        },
        [status.position, status.duration],
    );

    const cycleSpeed = useCallback(() => {
        setSpeed(prev => {
            const index = SPEEDS.indexOf(prev);
            const next = SPEEDS[(index + 1) % SPEEDS.length] ?? 1;
            tvVideo.setSpeed(next);
            if (audioModeRef.current === "song") {
                tvVideo.mvAudioSpeed(next);
            }
            return next;
        });
    }, []);

    /** 播放/暂停按钮：继续播放时顺手收起 HUD（传统播放器手感） */
    const toggleVideoPlay = useCallback(() => {
        if (videoRef.current?.kind === "web") {
            // 网页播放交给页面自身，这里只收起/显示我们的说明条
            setHud(prev => !prev);
            return;
        }
        if (pausedRef.current) {
            doPlay();
            setHud(false);
        } else {
            doPause();
            setHud(true);
        }
    }, [doPlay, doPause]);

    const injectWeb = useCallback((body: string) => {
        const js = `(function(){try{
            var run=function(v){ ${body} };
            var v=document.querySelector('video');
            if(v){run(v);return;}
            var ifr=document.querySelector('iframe');
            if(ifr){try{var d=ifr.contentDocument;var vv=d&&d.querySelector('video');if(vv){run(vv);}}catch(e){}}
        }catch(e){}})();`;
        webRef.current?.injectJavaScript(js);
    }, []);

    /** 连带页面里的 iframe 一起解锁声音（B 站播放页有时是嵌套的） */
    const injectWebFrames = useCallback((body: string) => {
        const js = `(function(){try{
            var run=function(v){ ${body} };
            document.querySelectorAll('video').forEach(run);
            document.querySelectorAll('iframe').forEach(function(f){
                try{var d=f.contentDocument;if(d){d.querySelectorAll('video').forEach(run);}}catch(e){}
            });
        }catch(e){}})();`;
        webRef.current?.injectJavaScript(js);
    }, []);

    const switchSong = useCallback(
        async (direction: "next" | "prev") => {
            // 播 MV 时切歌：把后台歌曲一起切走，画面由 currentMusic 变化的 effect 重新解析
            try {
                if (direction === "next") {
                    await TrackPlayer.skipToNext();
                } else {
                    await TrackPlayer.skipToPrevious();
                }
            } catch {
                setHint("没有更多歌曲了");
                return;
            }
            setHint("");
        },
        [],
    );

    useEffect(() => {
        if (!currentMusic) {
            return;
        }
        // 换歌：先把上一首的 MV 停掉清空，再去解析新的，避免"画面还是上一首"
        try {
            tvVideo.stop();
        } catch {}
        reopenCountRef.current = 0;
        reopenBusyRef.current = false;
        attemptRef.current = 0;
        setVideo(null);
        setStatus({ position: 0, duration: 0 });
        setPaused(false);
        setHud(false);
        resolveFromPlugin(currentMusic);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMusic?.id]);

    // MV 全屏期间焦点引擎一直挂起：控制条自带选择位置和高光环，避免引擎抢焦点
    useEffect(() => {
        if (hud) {
            setHudIndex(1);
        }
    }, [hud]);

    // 遥控器：网页播放时只保留返回/说明，原生播放走完整控制
    useTvKeys((key, action) => {
        if (action !== "down") {
            if (key === "center") {
                return true;
            }
            return false;
        }
        const v = videoRef.current;
        switch (key) {
            case "center": {
                if (!v) {
                    if (loading) {
                        return true;
                    }
                    resolveFromPlugin(currentMusic, { next: true });
                    return true;
                }
                if (v.kind === "web") {
                    // B 站播放页：注入 JS 直接停/继续页面里的 video 元素
                    injectWeb("if(v.paused){v.play()}else{v.pause()}");
                    injectWebFrames(
                        "try{if(!v.muted&&v.paused){v.play()}}catch(e){}",
                    );
                    if (!hudRef.current) {
                        setHint("网页播放：如无声，再按一次 OK");
                        setTimeout(() => setHint(""), 2500);
                    }
                    return true;
                }
                if (!hudRef.current) {
                    doPause();
                    setHud(true);
                    return true;
                }
                // HUD 内的 OK：进度条＝播放/暂停，图标按位置各自执行
                const idx = hudIndexRef.current;
                if (idx < 0 || idx === 1) {
                    toggleVideoPlay();
                } else if (idx === 0) {
                    switchSong("prev");
                } else if (idx === 2) {
                    switchSong("next");
                } else if (idx === 3) {
                    cycleSpeed();
                } else if (idx === 4) {
                    toggleAudioMode();
                }
                return true;
            }
            case "left":
                if (v?.kind === "web") {
                    return false;
                }
                if (v?.kind === "native") {
                    // 浮层没出来时，方向键只负责把浮层唤出来（不直接快退）
                    if (!hudRef.current) {
                        setHudIndex(1);
                        setHud(true);
                        return true;
                    }
                    // 只有光环停在进度条上，左右才是快退/快进
                    if (hudIndexRef.current < 0) {
                        seekBy(-nextSeekStep());
                    } else {
                        setHudIndex(prev => Math.max(0, prev - 1));
                    }
                    return true;
                }
                return false;
            case "right":
                if (v?.kind === "web") {
                    injectWeb("v.currentTime=v.currentTime+" + SEEK_STEP);
                    return true;
                }
                if (v?.kind === "native") {
                    if (!hudRef.current) {
                        setHudIndex(1);
                        setHud(true);
                        return true;
                    }
                    if (hudIndexRef.current < 0) {
                        seekBy(nextSeekStep());
                    } else {
                        setHudIndex(prev => Math.min(4, prev + 1));
                    }
                    return true;
                }
                return false;
            case "up":
                if (v?.kind === "native") {
                    if (!hudRef.current) {
                        setHudIndex(1);
                        setHud(true);
                        return true;
                    }
                    if (hudIndexRef.current >= 0) {
                        setHudIndex(-1);
                    }
                    return true;
                }
                return false;
            case "down":
                if (v?.kind === "native") {
                    if (!hudRef.current) {
                        setHudIndex(1);
                        setHud(true);
                        return true;
                    }
                    if (hudIndexRef.current < 0) {
                        setHudIndex(1);
                    }
                    return true;
                }
                return false;
            case "back":
                // 浮层开着时，返回键只关浮层，不退出 MV
                if (hudRef.current) {
                    setHud(false);
                    return true;
                }
                return false;
            case "forward":
                if (v?.kind === "native") {
                    seekBy(SEEK_STEP);
                    return true;
                }
                return false;
            case "rewind":
                if (v?.kind === "native") {
                    seekBy(-SEEK_STEP);
                    return true;
                }
                return false;
            case "playPause":
            case "play":
            case "pause":
                if (v?.kind === "native") {
                    pausedRef.current ? doPlay() : doPause();
                    setHud(true);
                    return true;
                }
                return false;
            case "next":
                switchSong("next");
                return true;
            case "previous":
                switchSong("prev");
                return true;
            default:
                return false;
        }
    });

    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            if (hudRef.current) {
                setHud(false);
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, []);

    const progressRatio =
        status.duration > 0
            ? Math.min(1, status.position / status.duration)
            : 0;
    const hudVisible = hud && !!video;

    return (
        <View style={styles.wrapper}>
            {video?.kind === "native" ? (
                <TvVideoView
                    style={styles.video}
                    muted={audioMode === "song"}
                    sourceHeaders={video.headers ?? undefined}
                    zoomCrop={1}
                    source={surfaceReady ? video.url : undefined}
                    paused={paused}
                    speed={speed}
                />
            ) : video?.kind === "web" ? (
                <WebView
                    ref={webRef}
                    style={styles.video}
                    source={{ uri: video.pageUrl }}
                    onLoadStart={() => setWebLoading(true)}
                    onLoadEnd={() => {
                        setWebLoading(false);
                        // B 站网页播放器默认静音自动播放：多轮注入，确保真的解除静音
                        [
                            120,
                            400,
                            900,
                            1600,
                            2600,
                            4000,
                            6000,
                            9000,
                        ].forEach(delay =>
                            setTimeout(() => {
                                if (webSongRef.current) {
                                    // 页面静音，声音由歌曲音轨出，避免两路叠加
                                    injectWeb(
                                        "v.muted=true; try{v.volume=0}catch(e){}; if(v.paused){v.play()}",
                                    );
                                    injectWebFrames(
                                        "try{v.muted=true;v.volume=0;if(v.paused){v.play()}}catch(e){}",
                                    );
                                } else {
                                    injectWeb(
                                        "v.muted=false; try{v.volume=1}catch(e){}; if(v.paused){v.play()}",
                                    );
                                    injectWebFrames(
                                        "try{v.muted=false;v.volume=1;if(v.paused){v.play()}}catch(e){}",
                                    );
                                }
                                // 把网页播放进度回报给 RN，好让歌曲音轨对齐画面
                                webRef.current?.injectJavaScript(`(function(){try{
                                    if(window.__mvReport===1){return}
                                    window.__mvReport=1;
                                    setInterval(function(){
                                        try{
                                            var v=document.querySelector('video');
                                            if(v&&v.currentTime){
                                                window.ReactNativeWebView.postMessage(JSON.stringify({mvTime:v.currentTime}));
                                            }
                                        }catch(e){}
                                    },1000);
                                }catch(e){}})();`);
                            }, delay),
                        );
                    }}
                    userAgent={WEB_UA}
                    javaScriptEnabled
                    domStorageEnabled
                    mediaPlaybackRequiresUserGesture={false}
                    allowsFullscreenVideo
                    allowsInlineMediaPlayback
                    setSupportMultipleWindows={false}
                    onMessage={(e: any) => {
                        try {
                            const d = JSON.parse(e?.nativeEvent?.data ?? "{}");
                            if (typeof d?.mvTime === "number") {
                                posRef.current = d.mvTime * 1000;
                            }
                        } catch {}
                    }}
                    onError={() => setHint("网页播放失败，试试重新解析")}
                />
            ) : (
                <View style={styles.placeholder}>
                    <Text style={styles.placeholderText}>
                        {loading ? "正在解析 MV…" : "暂无 MV 视频"}
                    </Text>
                    {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
                    {!loading ? (
                        <View style={styles.placeholderBtns}>
                            <View
                                style={styles.grayBtn}
                                onTouchEnd={() =>
                                    showQrInput({
                                        mode: "text",
                                        title: "手机扫码输入 MV 链接",
                                        onText: text => {
                                            const url = text.trim();
                                            if (VIDEO_PATTERN.test(url)) {
                                                applyResult({ url });
                                            } else {
                                                setHint(
                                                    "请输入 mp4 / m3u8 等视频地址",
                                                );
                                            }
                                        },
                                    })
                                }>
                                <Text style={styles.ctrlText}>
                                    扫码输入视频链接
                                </Text>
                            </View>
                            <View
                                style={styles.grayBtn}
                                onTouchEnd={() =>
                                    resolveFromPlugin(currentMusic)
                                }>
                                <Text style={styles.ctrlText}>重新解析当前歌曲</Text>
                            </View>
                        </View>
                    ) : null}
                </View>
            )}

            {video?.kind === "web" && webLoading ? (
                <View style={styles.webLoading} pointerEvents="none">
                    <Text style={styles.placeholderText}>
                        正在加载 B 站播放页…
                    </Text>
                </View>
            ) : null}

            {video?.kind === "web" ? (
                <View style={styles.webBar} pointerEvents="none">
                    <Text style={styles.title} numberOfLines={1}>
                        {currentMusic?.title ?? "MV"} · 视频来源：B站
                    </Text>
                    <Text style={styles.tipText}>
                        OK 暂停/继续 · ←→ 快进快退 · 返回键退出
                    </Text>
                </View>
            ) : null}

            {hudVisible ? (
                <View style={styles.hud} pointerEvents="box-none">
                    <Text style={styles.title} numberOfLines={1}>
                        {video?.kind === "web"
                            ? `B 站搬运 · ${video.title ?? currentMusic?.title ?? ""}`
                            : `${currentMusic?.title ?? ""}${
                                  (video as any)?.provider
                                      ? ` · ${(video as any).provider}`
                                      : ""
                              }`}
                    </Text>
                    {video?.kind === "native" ? (
                        <>
                            <Text style={styles.audioInfo} numberOfLines={1}>
                                {`来源 ${(video as any)?.provider ?? "-"} · ${
                                    status.audioFormat || "音轨参数未知"
                                } · 声音：${
                                    audioMode === "song" ? "歌曲音轨" : "视频原音"
                                }${
                                    status.trackReadable === true &&
                                    status.audioTracks === 0
                                        ? " · 视频流无音轨"
                                        : ""
                                }`}
                            </Text>
                            <View
                                style={[
                                    styles.hudRow,
                                    hudIndex < 0 ? styles.rowRing : null,
                                ]}>
                                <Text style={styles.timeText}>
                                    {formatTime(status.position)}
                                </Text>
                                <View style={styles.progressTrack}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            { width: `${progressRatio * 100}%` },
                                        ]}
                                    />
                                    <View
                                        style={[
                                            styles.progressDot,
                                            { left: `${progressRatio * 100}%` },
                                        ]}
                                    />
                                </View>
                                <Text style={styles.timeText}>
                                    {formatTime(status.duration)}
                                </Text>
                            </View>
                            <View style={styles.iconRow}>
                                <View
                                    style={[
                                        styles.iconBtn,
                                        hudIndex === 0 ? styles.iconBtnRing : null,
                                    ]}>
                                    <Icon
                                        accessible={false}
                                        name="skip-left"
                                        size={rpx(34)}
                                        color="#ffffff"
                                    />
                                </View>
                                <View
                                    style={[
                                        styles.iconBtn,
                                        styles.playBtn,
                                        hudIndex === 1 ? styles.iconBtnRing : null,
                                    ]}>
                                    <Icon
                                        accessible={false}
                                        name={paused ? "play" : "pause"}
                                        size={rpx(42)}
                                        color="#ffffff"
                                    />
                                </View>
                                <View
                                    style={[
                                        styles.iconBtn,
                                        hudIndex === 2 ? styles.iconBtnRing : null,
                                    ]}>
                                    <Icon
                                        accessible={false}
                                        name="skip-right"
                                        size={rpx(34)}
                                        color="#ffffff"
                                    />
                                </View>
                                <View
                                    style={[
                                        styles.iconBtn,
                                        styles.speedBtn,
                                        hudIndex === 3 ? styles.iconBtnRing : null,
                                    ]}>
                                    <Text style={styles.speedText}>
                                        {speed}x
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.iconBtn,
                                        styles.speedBtn,
                                        audioMode === "song"
                                            ? styles.audioOnBtn
                                            : null,
                                        hudIndex === 4 ? styles.iconBtnRing : null,
                                    ]}>
                                    <Text style={styles.speedText}>
                                        {audioMode === "song" ? "歌曲音轨" : "视频原音"}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.tipText}>
                                方向键选图标 · ←→ 在进度条上快退/快进 · OK 执行
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.tipText}>
                            网页内嵌播放 · OK 显示/收起此提示 · 返回键退出 MV
                        </Text>
                    )}
                </View>
            ) : null}

            {video?.kind === "native" && diagVisible ? (
                <View style={styles.diag} pointerEvents="none">
                    <Text style={styles.diagText} numberOfLines={1}>
                        {`诊断｜音轨 ${status.audioTracks ?? "?"} 条 / 画面 ${
                            status.videoTracks ?? "?"
                        } 条 · ${status.audioFormat || "-"} · 音量 ${
                            status.streamVolume ?? "-"
                        }/15 · ${audioMode === "song" ? "歌曲音轨" : "视频原音"}`}
                    </Text>
                </View>
            ) : null}

            {hint && video ? (
                <Text style={styles.toast} numberOfLines={2}>
                    {hint}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    diag: {
        position: "absolute",
        left: rpx(24),
        bottom: rpx(18),
    },
    diagText: {
        color: "rgba(255,255,255,0.55)",
        fontSize: rpx(16),
    },
    audioOnBtn: {
        backgroundColor: "rgba(32,180,106,0.35)",
    },
    audioInfo: {
        color: "rgba(255,255,255,0.72)",
        fontSize: rpx(20),
        marginTop: rpx(6),
    },
    wrapper: { flex: 1, width: "100%", height: "100%", backgroundColor: "#000" },
    video: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
    placeholder: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: rpx(60),
    },
    placeholderText: { color: "#8b98a9", fontSize: rpx(32) },
    hintText: {
        color: "#7f8da1",
        fontSize: rpx(24),
        marginTop: rpx(20),
        textAlign: "center",
        lineHeight: rpx(38),
    },
    placeholderBtns: {
        flexDirection: "row",
        marginTop: rpx(40),
    },
    hud: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: rpx(60),
        paddingBottom: rpx(48),
        paddingTop: rpx(24),
    },
    title: {
        color: "#ffffff",
        fontSize: rpx(30),
        marginBottom: rpx(16),
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowRadius: 8,
    },
    hudRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: rpx(10),
        paddingHorizontal: rpx(14),
        borderRadius: rpx(16),
        borderWidth: rpx(2),
        borderColor: "transparent",
    },
    rowRing: {
        borderColor: "rgba(91,225,255,0.85)",
        backgroundColor: "rgba(12,40,66,0.42)",
        shadowColor: "#5be1ff",
        shadowOpacity: 0.55,
        shadowRadius: rpx(14),
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
    },
    timeText: {
        color: "#ffffff",
        fontSize: rpx(24),
        minWidth: rpx(84),
        textAlign: "center",
    },
    progressTrack: {
        flex: 1,
        height: rpx(10),
        borderRadius: rpx(5),
        backgroundColor: "rgba(255,255,255,0.28)",
        marginHorizontal: rpx(20),
        overflow: "visible",
        justifyContent: "center",
    },
    progressFill: {
        height: rpx(10),
        borderRadius: rpx(5),
        backgroundColor: "#ffffff",
    },
    progressDot: {
        position: "absolute",
        top: rpx(-3),
        width: rpx(16),
        height: rpx(16),
        marginLeft: rpx(-8),
        borderRadius: rpx(8),
        backgroundColor: "#ffffff",
    },
    iconRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: rpx(16),
    },
    iconBtn: {
        width: rpx(72),
        height: rpx(72),
        borderRadius: rpx(36),
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: rpx(14),
        backgroundColor: "rgba(10,16,26,0.42)",
        borderWidth: rpx(1),
        borderColor: "rgba(200,225,255,0.32)",
    },
    playBtn: {
        width: rpx(84),
        height: rpx(84),
        borderRadius: rpx(42),
        backgroundColor: "rgba(10,16,26,0.55)",
    },
    speedBtn: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(14),
    },
    iconBtnRing: {
        borderColor: "#5be1ff",
        borderWidth: rpx(2),
        backgroundColor: "rgba(18,52,84,0.62)",
        shadowColor: "#5be1ff",
        shadowOpacity: 0.65,
        shadowRadius: rpx(12),
        shadowOffset: { width: 0, height: 0 },
    },
    speedText: { color: "#ffffff", fontSize: rpx(24) },
    webLoading: {
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
    },
    webBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: rpx(60),
        paddingBottom: rpx(26),
        paddingTop: rpx(18),
        backgroundColor: "rgba(6,10,18,0.45)",
    },
    tipText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: rpx(22),
        textAlign: "center",
        marginTop: rpx(14),
    },
    toast: {
        position: "absolute",
        left: rpx(60),
        right: rpx(60),
        top: rpx(60),
        color: "#ffd8a8",
        fontSize: rpx(24),
        textAlign: "center",
    },
    grayBtn: {
        paddingHorizontal: rpx(28),
        paddingVertical: rpx(16),
        borderRadius: rpx(12),
        backgroundColor: "rgba(120,130,150,0.20)",
        marginHorizontal: rpx(12),
    },
    ctrlText: { color: "#eef4fb", fontSize: rpx(26) },
});
