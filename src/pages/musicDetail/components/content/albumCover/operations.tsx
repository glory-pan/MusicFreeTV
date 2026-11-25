import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import rpx, { vh } from "@/utils/rpx";

import LocalMusicSheet from "@/core/localMusicSheet";
import { ROUTE_PATH } from "@/core/router";
import Toast from "@/utils/toast";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useCurrentMusic, useMusicQuality, useRepeatMode } from "@/core/trackPlayer";
import PersistStatus from "@/utils/persistStatus";
import PluginManager from "@/core/pluginManager";
import downloader from "@/core/downloader";
import i18n from "@/core/i18n";
import { TvFocusable } from "@/tv/components";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { qualityText } from "@/utils/qualities";
import QualityGlyph from "./qualityGlyph";

const REPEAT_LABEL: Record<string, string> = {
    QUEUE: "列表循环",
    SHUFFLE: "随机播放",
    SINGLE: "单曲循环",
};

export default function Operations() {
    const musicItem = useCurrentMusic();
    const currentQuality = useMusicQuality();
    const isDownloaded = LocalMusicSheet.useIsLocal(musicItem);
    const repeatMode = useRepeatMode();
    const rate = PersistStatus.useValue("music.rate", 100);

    const supportComment = useMemo(() => {
        return !musicItem
            ? false
            : !!PluginManager.getByMedia(musicItem)?.supportedMethods.has(
                  "getMusicComments",
              );
    }, [musicItem]);

    const repeatLabel = REPEAT_LABEL[String(repeatMode)] ?? "列表循环";

    const items: Array<{
        key: string;
        title: string;
        icon?: any;
        glyph?: "quality";
        hidden?: boolean;
        onPress: () => void;
    }> = [
        {
            key: "repeat",
            icon: repeatMode === "SHUFFLE" ? "shuffle" : repeatMode === "SINGLE" ? "repeat-song-1" : "repeat-song",
            title: repeatLabel,
            onPress: () => {
                // 内部会 顺序 → 随机 → 单曲 循环，并自行持久化
                TrackPlayer.toggleRepeatMode();
            },
        },
        {
            key: "quality",
            glyph: "quality",
            title: `音质·${qualityText[currentQuality] ?? "标准"}`,
            onPress: () => {
                if (!musicItem) {
                    return;
                }
                showPanel("MusicQuality", {
                    musicItem,
                    async onQualityPress(quality) {
                        const result = await TrackPlayer.changeQuality(quality);
                        if (!result) {
                            Toast.warn(
                                i18n.t("toast.currentQualityNotAvailableForCurrentMusic"),
                            );
                        }
                    },
                });
            },
        },
        {
            key: "rate",
            title: "倍速",
            hidden: true,
            onPress: () => {
                showPanel("PlayRate", {
                    async onRatePress(newRate) {
                        if (rate !== newRate) {
                            await TrackPlayer.setRate(newRate / 100);
                            PersistStatus.set("music.rate", newRate);
                        }
                    },
                });
            },
        },
        {
            key: "download",
            title: "下载",
            hidden: true,
            onPress: () => {
                if (musicItem && !isDownloaded) {
                    showPanel("MusicQuality", {
                        type: "download",
                        musicItem,
                        async onQualityPress(quality) {
                            downloader.download(musicItem, quality);
                        },
                    });
                }
            },
        },
        {
            key: "comment",
            icon: "chat-bubble-oval-left-ellipsis",
            title: supportComment ? "评论" : "暂无评论",
            onPress: () => {
                if (!supportComment) {
                    Toast.warn(
                        i18n.t("toast.commmentNotAvaliableForCurrentMusic"),
                    );
                    return;
                }
                if (musicItem) {
                    showPanel("MusicComment", { musicItem });
                }
            },
        },
        {
            key: "more",
            icon: "ellipsis-vertical",
            title: "更多",
            onPress: () => {
                if (!musicItem) {
                    return;
                }
                // 电视端卡片：只有倍速播放 / 下载歌曲，光环逐行贴合
                showPanel("MusicMoreOptions", { musicItem });
            },
        },
    ];

    return (
        <View style={styles.wrapper}>
            {items
                .filter(item => !item.hidden)
                .map((item, index) => (
                    <TvFocusable
                        key={item.key}
                        name={`tvops:${item.key}`}
                        focusOrder={10 + index}
                        style={styles.button}
                        onPress={item.onPress}>
                        {item.glyph === "quality" ? (
                            <QualityGlyph color="#ffffff" size={vh(2.6)} />
                        ) : (
                            <Icon
                                accessible={false}
                                name={item.icon ?? "ellipsis-vertical"}
                                size={vh(2.5)}
                                color="#ffffff"
                            />
                        )}
                    </TvFocusable>
                ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: rpx(8),
    },
    label: {
        marginLeft: rpx(8),
    },
    button: {
        flex: 1,
        height: vh(5.4),
        borderRadius: rpx(14),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
});
