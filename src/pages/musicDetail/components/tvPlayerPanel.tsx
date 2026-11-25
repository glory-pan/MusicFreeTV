import React, { useEffect, useRef } from "react";
import { tvFocus } from "@/tv/focusStore";
import { panelInfoStore } from "@/components/panels/usePanel";
import { Animated, Easing, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { TvFocusable } from "@/tv/components";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, {
    useCurrentMusic,
    useMusicState,
    useProgress,
} from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import useColors from "@/hooks/useColors";
import rpx, { vh } from "@/utils/rpx";
import Operations from "./content/albumCover/operations";
import MotionPlayGlyph from "./content/albumCover/motionPlayGlyph";
import EqGlyph from "./content/albumCover/eqGlyph";
import Toast from "@/utils/toast";
import MusicSheet, { useFavorite } from "@/core/musicSheet";

function fmt(seconds?: number | null) {
    const s = Math.max(0, Math.floor(seconds ?? 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * 播放时的「氛围感」音符条：
 * 26 根竖条，青→紫 / 蓝→粉 / 金→橙 / 绿→青 的柔和渐变，原生线程驱动，
 * 每根独立相位与速度，形成波浪式律动（不是整齐划一的机械跳动）。
 * 暂停时保留在低位静止，不会塌陷，避免整页布局跳动。
 */
/** 频谱竖条数量：要像视频里那样细密 */
const NOTE_COUNT = 96;
/**
 * 色带关键色（沿横轴平滑插值）：
 * 粉紫 → 紫 → 蓝紫 → 浅蓝 → 青 → 黄绿 → 柠檬黄 → 橙 → 红 → 玫红
 */
const SPECTRUM_STOPS = [
    "#ff5ad1",
    "#c76bff",
    "#8f8bff",
    "#6fc6ff",
    "#63e8d0",
    "#8fe36a",
    "#f0e75c",
    "#f2a63c",
    "#f2604c",
    "#ff4d6d",
];

function hexToRgb(hex: string) {
    const v = hex.replace("#", "");
    return [
        parseInt(v.slice(0, 2), 16),
        parseInt(v.slice(2, 4), 16),
        parseInt(v.slice(4, 6), 16),
    ];
}

/** 按 0~1 的位置在关键色之间做线性插值，得到平滑的横向色带 */
function spectrumColor(pos: number) {
    const t = Math.min(1, Math.max(0, pos)) * (SPECTRUM_STOPS.length - 1);
    const i = Math.min(SPECTRUM_STOPS.length - 2, Math.floor(t));
    const f = t - i;
    const a = hexToRgb(SPECTRUM_STOPS[i]);
    const b = hexToRgb(SPECTRUM_STOPS[i + 1]);
    const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** 每条的高度包络：一串高、一串矮的簇状起伏，再叠一层随机，避免机械感 */
function noteEnvelope(index: number) {
    const cluster = Math.abs(
        Math.sin(index * 0.26 + 1.1) * Math.cos(index * 0.09 + 0.4),
    );
    const rnd = 0.45 + ((index * 19) % 53) / 100;
    return Math.min(1, 0.22 + cluster * rnd * 0.95);
}

/**
 * 播放页频谱：黑底居中对称的细竖条（每条以中线为轴上下延伸），
 * 横向 粉紫→紫→蓝→青→黄绿→黄→橙→红 平滑过渡，
 * 播放时成簇剧烈起伏，暂停时隐藏但保留高度。
 */
function MusicNotes({ playing }: { playing: boolean }) {
    const anims = useRef(
        Array.from({ length: NOTE_COUNT }, () => new Animated.Value(0.12)),
    ).current;

    useEffect(() => {
        if (!playing) {
            anims.forEach(a => a.setValue(0.12));
            return;
        }
        const loops = anims.map((value, index) => {
            const env = noteEnvelope(index);
            const peak = Math.min(1, 0.18 + env * 0.9);
            const low = 0.08 + ((index * 7) % 12) / 100;
            const up = 90 + ((index * 37) % 220);
            const down = 80 + ((index * 29) % 200);
            const delay = (index * 31) % 240;
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(value, {
                        toValue: peak,
                        duration: up,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(value, {
                        toValue: low,
                        duration: down,
                        easing: Easing.in(Easing.cubic),
                        useNativeDriver: true,
                    }),
                    Animated.delay(delay),
                ]),
            );
        });
        loops.forEach(loop => loop.start());
        return () => {
            loops.forEach(loop => loop.stop());
        };
    }, [playing]);

    return (
        <View
            style={[styles.notes, { opacity: playing ? 1 : 0 }]}
            pointerEvents="none">
            {anims.map((value, index) => (
                <View key={`note-${index}`} style={styles.noteBarWrap}>
                    <Animated.View
                        style={[
                            styles.noteBar,
                            {
                                backgroundColor: spectrumColor(
                                    index / (NOTE_COUNT - 1),
                                ),
                                transform: [{ scaleY: value }],
                            },
                        ]}
                    />
                </View>
            ))}
        </View>
    );
}

export default function TvPlayerPanel({
    onOpenEqualizer,
}: {
    onOpenEqualizer?: () => void;
}) {
    const navigate = useNavigate();
    const musicState = useMusicState();
    const currentMusic = useCurrentMusic();

    const progress = useProgress(500);
    const colors = useColors();
    const paused = musicIsPaused(musicState);
    const isFavorite = useFavorite(currentMusic ?? null);
    // 本地乐观态：按 OK 的瞬间图标就要变实心/空心，不能等歌单那边的
    // 事件回传（回传链条里只要有一环没走通，用户看到的就是"点了没反应"）
    const [localFav, setLocalFav] = React.useState(isFavorite);
    React.useEffect(() => {
        setLocalFav(isFavorite);
    }, [isFavorite, currentMusic?.id]);

    // 进播放页把焦点落到进度条；从 MV/视频页返回时同样要重新落位
    useEffect(() => {
        // 进播放页首焦点必须是进度条。
        // 进度条要等布局完成才有坐标，所以分几次补：只要当前焦点不是 seek 就再放一次。
        const put = () => {
            // 面板（音质/播放列表/字体大小…）打开期间绝对不许抢焦点，
            // 否则刚打开卡片、光环就被拉回进度条
            if (panelInfoStore.getValue().name) {
                return;
            }
            const focused = tvFocus.getFocusedNode();
            if (!focused || focused.debugName !== "seek") {
                tvFocus.focusByName("seek", true);
            }
        };
        put();
        const timers = [220, 600, 1200, 2000].map(delay =>
            setTimeout(put, delay),
        );
        return () => timers.forEach(clearTimeout);
    }, []);

    if (!currentMusic) {
        return null;
    }

    const position = (progress?.position as number) ?? 0;
    const duration = (progress?.duration as number) ?? 0;
    const percent = duration > 0 ? Math.min(1, position / duration) : 0;

    const seekBy = (delta: number) => {
        const target = Math.max(
            0,
            Math.min(duration || position + delta, position + delta),
        );
        TrackPlayer.seekTo(target);
    };

    const toggleFavorite = () => {
        const next = !localFav;
        // 先切图标，再落库：点一下就一定有反馈
        setLocalFav(next);
        try {
            if (!next) {
                MusicSheet.removeMusic("favorite", currentMusic);
                Toast.success("已取消收藏");
            } else {
                MusicSheet.addMusic("favorite", currentMusic);
                Toast.success("已收藏到「我喜欢」");
            }
        } catch (e: any) {
            Toast.warn(e?.message ?? "收藏失败");
        }
    };

    const transport: Array<{
        key: string;
        icon: "skip-left" | "play" | "pause" | "skip-right";
        onPress: () => void;
        primary?: boolean;
    }> = [
        {
            key: "prev",
            icon: "skip-left",
            onPress: () => TrackPlayer.skipToPrevious(),
        },
        {
            key: "toggle",
            icon: paused ? "play" : "pause",
            primary: true,
            onPress: () => {
                if (paused) {
                    TrackPlayer.play();
                } else {
                    TrackPlayer.pause();
                }
            },
        },
        {
            key: "next",
            icon: "skip-right",
            onPress: () => TrackPlayer.skipToNext(),
        },
    ];

    const features: Array<{
        key: string;
        glyph?: "eq" | "mv";
        icon?: any;
        onPress: () => void;
    }> = [
        {
            key: "eq",
            glyph: "eq",
            onPress: () => onOpenEqualizer?.(),
        },
        {
            key: "mv",
            glyph: "mv",
            onPress: () => navigate(ROUTE_PATH.MV),
        },
        {
            key: "list",
            icon: "bars-3",
            onPress: () => showPanel("PlayList"),
        },
        {
            key: "heart",
            icon: localFav ? "heart" : "heart-outline",
            onPress: toggleFavorite,
        },
        {
            key: "add",
            icon: "plus",
            onPress: () =>
                showPanel("AddToMusicSheet", { musicItem: currentMusic }),
        },
    ];

    return (
        <View style={styles.container}>
            <MusicNotes playing={!paused} />

            <TvFocusable
                name="seek"
                focusOrder={0}
                style={styles.seekBox}
                onPress={() => {
                    if (paused) {
                        TrackPlayer.play();
                    } else {
                        TrackPlayer.pause();
                    }
                }}>
                <View style={styles.seekTrack}>
                    <View
                        style={[
                            styles.seekFill,
                            {
                                width: `${percent * 100}%`,
                                backgroundColor: colors.primary,
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.seekThumb,
                            {
                                left: `${Math.round(percent * 100)}%`,
                                backgroundColor: colors.primary,
                            },
                        ]}
                    />
                </View>
                <View style={styles.timeRow}>
                    <ThemeText fontSize="subTitle">{fmt(position)}</ThemeText>
                    <ThemeText fontSize="subTitle">{fmt(duration)}</ThemeText>
                </View>
            </TvFocusable>

            <View style={styles.transportRow}>
                {transport.map((item, index) => (
                    <TvFocusable
                        key={item.key}
                        name={`tvplayer:${item.key}`}
                        focusOrder={index + 1}
                        onPress={item.onPress}
                        style={
                            item.primary
                                ? [
                                      styles.playButton,
                                      { backgroundColor: colors.primary },
                                  ]
                                : styles.transportButton
                        }>
                        <Icon
                            accessible={false}
                            name={item.icon}
                            size={item.primary ? vh(3.4) : vh(2.6)}
                            color="#ffffff"
                        />
                    </TvFocusable>
                ))}
            </View>

            <View style={styles.featureRow}>
                {features.map((item, index) => (
                    <TvFocusable
                        key={item.key}
                        name={`tvplayer:${item.key}`}
                        focusOrder={index + 20}
                        onPress={item.onPress}
                        style={styles.iconButton}>
                        {item.glyph === "eq" ? (
                            <EqGlyph color="#ffffff" size={vh(2.8)} />
                        ) : item.glyph === "mv" ? (
                            <MotionPlayGlyph color="#ffffff" size={vh(2.8)} />
                        ) : (
                            <Icon
                                accessible={false}
                                name={item.icon}
                                size={vh(2.7)}
                                color="#ffffff"
                            />
                        )}
                    </TvFocusable>
                ))}
            </View>

            <View style={styles.opsRow}>
                <Operations />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        paddingHorizontal: rpx(14),
        paddingBottom: vh(1.6),
    },
    notes: {
        height: vh(3.8),
        width: "100%",
        flexDirection: "row",
        // 居中对称：每条以中线为轴上下延伸，跟参考视频完全一致
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: rpx(2),
        marginBottom: vh(1.0),
    },
    noteBarWrap: {
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        flex: 1,
        marginHorizontal: rpx(0.35),
    },
    noteBar: {
        width: "100%",
        height: "100%",
        borderRadius: rpx(1),
    },
    seekBox: {
        width: "100%",
        height: vh(7.4),
        borderRadius: rpx(14),
        borderWidth: rpx(2),
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.06)",
        paddingHorizontal: rpx(16),
        justifyContent: "center",
    },
    seekTrack: {
        width: "100%",
        height: vh(1.2),
        borderRadius: vh(1.2),
        backgroundColor: "rgba(255,255,255,0.22)",
        justifyContent: "center",
    },
    seekFill: {
        height: vh(1.2),
        borderRadius: vh(1.2),
    },
    seekThumb: {
        position: "absolute",
        width: vh(1.9),
        height: vh(1.9),
        borderRadius: vh(1),
        marginLeft: -vh(0.95),
    },
    timeRow: {
        width: "100%",
        marginTop: vh(1.1),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    transportRow: {
        width: "100%",
        height: vh(8.4),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: vh(2.6),
        marginTop: vh(0.6),
    },
    playButton: {
        width: vh(8.6),
        height: vh(8.6),
        borderRadius: vh(4.3),
        alignItems: "center",
        justifyContent: "center",
    },
    transportButton: {
        width: vh(6.4),
        height: vh(6.4),
        borderRadius: vh(1.6),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    featureRow: {
        width: "100%",
        height: vh(5.2),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: rpx(8),
        marginTop: vh(1.8),
    },
    iconButton: {
        flex: 1,
        height: "100%",
        borderRadius: rpx(14),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    opsRow: {
        width: "100%",
        marginTop: vh(1.4),
    },
});
