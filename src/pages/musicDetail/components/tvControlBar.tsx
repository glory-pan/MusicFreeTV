import React from "react";
import { StyleSheet, View } from "react-native";
import { TvFocusable } from "@/tv";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer, { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";

/**
 * 播放页的电视控制条：遥控器直接可用的按钮组。
 * 手机端的播放页大量依赖手势（点击封面、拖动进度条），电视上没有手指，
 * 这里给出一排标准按钮，保证播放页在盒子上完全可以遥控操作。
 */
export default function TvControlBar() {
    const navigate = useNavigate();
    const musicState = useMusicState();
    const currentMusic = useCurrentMusic();
    const colors = useColors();
    const paused = musicIsPaused(musicState);

    const actions: Array<{ title: string; onPress: () => void; primary?: boolean }> = [
        {
            title: "上一首",
            onPress: () => {
                TrackPlayer.skipToPrevious();
            },
        },
        {
            title: "-15s",
            onPress: async () => {
                const p = await TrackPlayer.getProgress();
                const pos = p?.position ?? 0;
                if (pos > 0) {
                    TrackPlayer.seekTo(Math.max(0, pos - 15));
                }
            },
        },
        {
            title: paused ? "播放" : "暂停",
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
            title: "+15s",
            onPress: async () => {
                const p = await TrackPlayer.getProgress();
                const pos = p?.position ?? 0;
                const dur = p?.duration ?? 0;
                TrackPlayer.seekTo(Math.min(dur || pos + 15, pos + 15));
            },
        },
        {
            title: "下一首",
            onPress: () => {
                TrackPlayer.skipToNext();
            },
        },
        {
            title: "音效",
            onPress: () => {
                navigate(ROUTE_PATH.EQUALIZER);
            },
        },
        {
            title: "MV",
            onPress: () => {
                navigate(ROUTE_PATH.MV);
            },
        },
        {
            title: "返回",
            onPress: () => {
                navigate(ROUTE_PATH.HOME);
            },
        },
    ];

    if (!currentMusic) {
        return null;
    }

    return (
        <View style={[styles.container, { borderTopColor: colors.divider }]}>
            {actions.map(item => (
                <TvFocusable
                    key={item.title}
                    name={`player:${item.title}`}
                    onPress={item.onPress}
                    style={[
                        styles.button,
                        {
                            backgroundColor: item.primary
                                ? colors.primary
                                : colors.card,
                        },
                    ]}>
                    <ThemeText
                        fontSize="description"
                        fontWeight="bold"
                        fontColor={item.primary ? "text" : "text"}>
                        {item.title}
                    </ThemeText>
                </TvFocusable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: rpx(8),
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: rpx(8),
    },
    button: {
        // 电视屏宽有限：6 个按钮必须能在一行里放下，
        // 之前的 150rpx 宽度会直接超屏，导致"上一首被挡住看不到"。
        minWidth: rpx(88),
        height: rpx(46),
        borderRadius: rpx(10),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: rpx(10),
    },
});
