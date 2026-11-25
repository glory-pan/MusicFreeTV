import React from "react";
import { TvScrollView } from "@/tv/scroll";
import { StyleSheet } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Clipboard from "@react-native-clipboard/clipboard";

import { getMediaUniqueKey } from "@/utils/mediaUtils";
import Toast from "@/utils/toast";
import LocalMusicSheet from "@/core/localMusicSheet";
import { localMusicSheetId, musicHistorySheetId } from "@/constants/commonConst";
import { ROUTE_PATH } from "@/core/router";

import TvCardPanel from "../base/tvCardPanel";
import { TvFocusable } from "@/tv/components";
import Icon from "@/components/base/icon";

import musicHistory from "@/core/musicHistory";
import { showDialog } from "@/components/dialogs/useDialog";
import { hidePanel, showPanel } from "../usePanel";
import Config from "@/core/appConfig";
import TrackPlayer from "@/core/trackPlayer";
import mediaCache from "@/core/mediaCache";
import { IIconName } from "@/components/base/icon.tsx";
import MusicSheet from "@/core/musicSheet";
import downloader from "@/core/downloader";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import lyricManager from "@/core/lyricManager";
import { useI18N } from "@/core/i18n";
import pluginManager from "@/core/pluginManager";

interface IMusicItemOptionsProps {
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
    /** 歌曲所在歌单 */
    musicSheet?: IMusic.IMusicSheetItem;
    /** 来源 */
    from?: string;
}

const ITEM_HEIGHT = rpx(96);

interface IOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
    show?: boolean;
}

export default function MusicItemOptions(props: IMusicItemOptionsProps) {
    const { musicItem, musicSheet, from } = props ?? {};
    const { t } = useI18N();

    const downloaded = LocalMusicSheet.isLocalMusic(musicItem);
    const associatedLrc = getMediaExtraProperty(musicItem, "associatedLrc");

    const options: IOption[] = [
        {
            icon: "identification",
            title: `ID: ${getMediaUniqueKey(musicItem)}`,
            onPress: () => {
                mediaCache.setMediaCache(musicItem);
                Clipboard.setString(
                    JSON.stringify(
                        {
                            platform: musicItem.platform,
                            id: musicItem.id,
                        },
                        null,
                        "",
                    ),
                );
                Toast.success(t("toast.copiedToClipboard"));
            },
        },
        {
            icon: "user",
            title: t("panel.musicItemOptions.author", { artist: musicItem.artist }),
            onPress: () => {
                try {
                    Clipboard.setString(musicItem.artist.toString());
                    Toast.success(t("toast.copiedToClipboard"));
                } catch {
                    Toast.warn(t("toast.copiedToClipboardFailed"));
                }
            },
        },
        {
            icon: "album-outline",
            show: !!musicItem.album,
            title: t("panel.musicItemOptions.album", { album: musicItem.album }),
            onPress: () => {
                try {
                    Clipboard.setString(musicItem.album.toString());
                    Toast.success(t("toast.copiedToClipboard"));
                } catch {
                    Toast.warn(t("toast.copiedToClipboardFailed"));
                }
            },
        },
        {
            icon: "motion-play",
            title: t("musicListEditor.addToNextPlay"),
            onPress: () => {
                TrackPlayer.addNext(musicItem);
                hidePanel();
            },
        },
        {
            icon: "folder-plus",
            title: t("musicListEditor.addToSheet"),
            onPress: () => {
                showPanel("AddToMusicSheet", { musicItem });
            },
        },
        {
            icon: "arrow-down-tray",
            title: t("common.download"),
            show: !downloaded,
            onPress: async () => {
                showPanel("MusicQuality", {
                    musicItem,
                    type: "download",
                    async onQualityPress(quality) {
                        downloader.download(musicItem, quality);
                    },
                });
            },
        },
        {
            icon: "check-circle-outline",
            title: t("panel.musicItemOptions.downloaded"),
            show: !!downloaded,
        },
        {
            icon: "trash-outline",
            title: t("common.delete"),
            show: !!musicSheet,
            onPress: async () => {
                if (musicSheet?.id === localMusicSheetId) {
                    await LocalMusicSheet.removeMusic(musicItem);
                } else if (musicSheet?.id === musicHistorySheetId) {
                    await musicHistory.removeMusic(musicItem);
                } else {
                    await MusicSheet.removeMusic(musicSheet!.id, musicItem);
                }
                Toast.success(t("toast.deleteSuccess"));
                hidePanel();
            },
        },
        {
            icon: "trash-outline",
            title: t("panel.musicItemOptions.deleteLocalDownload"),
            show: !!downloaded,
            onPress: () => {
                showDialog("SimpleDialog", {
                    title: t("panel.musicItemOptions.deleteLocalDownload"),
                    content: t("panel.musicItemOptions.deleteLocalDownloadConfirm"),
                    async onOk() {
                        try {
                            await LocalMusicSheet.removeMusic(musicItem, true);
                            Toast.success(t("toast.deleteSuccess"));
                        } catch (e: any) {
                            Toast.warn(`${t("panel.musicItemOptions.deleteFailed")} ${e?.message ?? e}`);
                        }
                    },
                });
                hidePanel();
            },
        },
        {
            icon: "link",
            title: associatedLrc
                ? t("panel.musicItemOptions.associatedLyric", { platform: associatedLrc.platform, id: associatedLrc.id })
                : t("panel.musicItemOptions.associateLyric"),
            onPress: async () => {
                if (
                    Config.getConfig("basic.associateLyricType") === "input"
                ) {
                    showPanel("AssociateLrc", {
                        musicItem,
                    });
                } else {
                    showPanel("SearchLrc", {
                        musicItem,
                    });
                }
            },
        },
        {
            icon: "link-slash",
            title: t("panel.musicItemOptions.unassociateLyric"),
            show: !!associatedLrc,
            onPress: async () => {
                lyricManager.unassociateLyric(musicItem);
                Toast.success(t("panel.musicItemOptions.unassociateLyricSuccess"));
                hidePanel();
            },
        },
        {
            icon: "alarm-outline",
            title: t("panel.musicItemOptions.timingClose"),
            show: from === ROUTE_PATH.MUSIC_DETAIL,
            onPress: () => {
                showPanel("TimingClose");
            },
        },
        {
            icon: "archive-box-x-mark",
            title: t("panel.musicItemOptions.clearPluginCache"),
            onPress: () => {
                mediaCache.removeMediaCache(musicItem);
                Toast.success(t("panel.musicItemOptions.cacheCleared"));
            },
        },
    ];

    const visibleOptions = options.filter(it => it.show !== false);

    return (
        <TvCardPanel
            title={musicItem?.title ?? ""}
            firstFocusName="miopt:0"
            returnFocusName="tvops:more">
            <TvScrollView style={style.list}>
                {visibleOptions.map((item, index) => (
                    <TvFocusable
                        key={`${item.title}-${index}`}
                        name={`miopt:${index}`}
                        focusOrder={index}
                        style={style.row}
                        onPress={item.onPress}>
                        <Icon
                            accessible={false}
                            name={item.icon}
                            size={rpx(30)}
                            color="#ffffff"
                        />
                        <ThemeText
                            fontSize="subTitle"
                            numberOfLines={1}
                            style={style.rowText}>
                            {item.title}
                        </ThemeText>
                    </TvFocusable>
                ))}
            </TvScrollView>
        </TvCardPanel>
    );
}

const style = StyleSheet.create({
    list: {
        width: "100%",
        maxHeight: rpx(420),
    },
    row: {
        width: "100%",
        height: rpx(78),
        paddingHorizontal: rpx(18),
        marginVertical: rpx(4),
        borderRadius: rpx(12),
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.06)",
    },
    rowText: {
        marginLeft: rpx(16),
        flexShrink: 1,
    },
});
