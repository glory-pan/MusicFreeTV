import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { useAppConfig } from "@/core/appConfig";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import { hidePanel, showPanel } from "@/components/panels/usePanel";
import TrackPlayer from "@/core/trackPlayer";
import PersistStatus from "@/utils/persistStatus";
import lyricManager, { useLyricState } from "@/core/lyricManager";
import { TvFocusable } from "@/tv/components";
import Icon from "@/components/base/icon";

interface ILyricOperationsProps {
    scrollToCurrentLrcItem: () => void;
}

/** 歌词工具行（纯 TV 版）：五个大按钮，全部可遥控聚焦 */
export default function LyricOperations(props: ILyricOperationsProps) {
    const { scrollToCurrentLrcItem } = props;
    const detailFontSize = useAppConfig("lyric.detailFontSize");
    const { hasTranslation } = useLyricState();
    const showTranslation = PersistStatus.useValue("lyric.showTranslation", false);
    const colors = useColors();

    const items = [
        {
            key: "font",
            icon: "font-size",
            title: "字号",
            onPress: () => {
                showPanel("SetFontSize", {
                    defaultSelect: detailFontSize ?? 1,
                    onSelectChange(value) {
                        PersistStatus.set("lyric.detailFontSize", value);
                        scrollToCurrentLrcItem();
                    },
                });
            },
        },
        {
            key: "offset",
            icon: "arrow-long-left",
            title: "歌词偏移",
            onPress: () => {
                const currentMusicItem = TrackPlayer.currentMusic;
                if (currentMusicItem) {
                    showPanel("SetLyricOffset", {
                        musicItem: currentMusicItem,
                        onSubmit(offset) {
                            lyricManager.updateLyricOffset(currentMusicItem, offset);
                            scrollToCurrentLrcItem();
                            hidePanel();
                        },
                    });
                }
            },
        },
        {
            key: "search",
            icon: "magnifying-glass",
            title: "搜索歌词",
            onPress: () => {
                const currentMusic = TrackPlayer.currentMusic;
                if (currentMusic) {
                    showPanel("SearchLrc", { musicItem: currentMusic });
                }
            },
        },
        {
            key: "trans",
            icon: "translation",
            title: showTranslation && hasTranslation ? "译文 · 开" : "译文 · 关",
            onPress: () => {
                if (!hasTranslation) {
                    Toast.warn("当前歌曲无翻译");
                    return;
                }
                PersistStatus.set("lyric.showTranslation", !showTranslation);
                scrollToCurrentLrcItem();
            },
        },
        {
            key: "more",
            icon: "ellipsis-vertical",
            title: "更多",
            onPress: () => {
                const currentMusic = TrackPlayer.currentMusic;
                if (currentMusic) {
                    showPanel("MusicItemLyricOptions", { musicItem: currentMusic });
                }
            },
        },
    ];

    return (
        <View style={styles.container}>
            {items.map((item, index) => (
                <TvFocusable
                    key={item.key}
                    name={`lrcops:${item.key}`}
                    focusOrder={60 + index}
                    style={[
                        styles.button,
                        item.key === "trans" && showTranslation && hasTranslation
                            ? { backgroundColor: colors.primary }
                            : null,
                    ]}
                    onPress={item.onPress}>
                    <Icon
                        accessible={false}
                        name={(item as any).icon}
                        size={rpx(38)}
                        color="#ffffff"
                    />
                </TvFocusable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: rpx(64),
        marginBottom: rpx(16),
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: rpx(10),
    },
    button: {
        width: rpx(96),
        height: rpx(52),
        borderRadius: rpx(12),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: rpx(12),
        backgroundColor: "rgba(255,255,255,0.08)",
    },
});
