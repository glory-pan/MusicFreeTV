import FastImage from "@/components/base/fastImage";
import { TvScrollView } from "@/tv/scroll";
import { TvFocusable } from "@/tv/components";
import TvCardPanel from "../base/tvCardPanel";
import Icon from "@/components/base/icon";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { getMediaUniqueKey } from "@/utils/mediaUtils";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import React from "react";
import { StyleSheet, View } from "react-native";

import Divider from "@/components/base/divider";
import { IIconName } from "@/components/base/icon.tsx";
import { hidePanel } from "@/components/panels/usePanel.ts";
import { iconSizeConst } from "@/constants/uiConst";
import Config from "@/core/appConfig";
import lyricManager from "@/core/lyricManager";
import mediaCache from "@/core/mediaCache";
import LyricUtil from "@/native/lyricUtil";
import { getDocumentAsync } from "expo-document-picker";
import { readAsStringAsync } from "expo-file-system";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18N } from "@/core/i18n";

interface IMusicItemLyricOptionsProps {
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
}

const ITEM_HEIGHT = rpx(96);

interface IOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
    show?: boolean;
}

export default function MusicItemLyricOptions(
    props: IMusicItemLyricOptionsProps,
) {
    const { musicItem } = props ?? {};

    const safeAreaInsets = useSafeAreaInsets();
    const { t } = useI18N();

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
            title: t("panel.musicItemLyricOptions.author", { artist: musicItem.artist }),
            onPress: () => {
                try {
                    Clipboard.setString(musicItem.artist.toString());
                    Toast.success(t("toast.copiedToClipboard"));
                } catch {
                    Toast.success(t("toast.copiedToClipboardFailed"));
                }
            },
        },
        {
            icon: "album-outline",
            show: !!musicItem.album,
            title: t("panel.musicItemLyricOptions.album", { album: musicItem.album }),
            onPress: () => {
                try {
                    Clipboard.setString(musicItem.album.toString());
                    Toast.success(t("toast.copiedToClipboard"));
                } catch {
                    Toast.success(t("toast.copiedToClipboardFailed"));
                }
            },
        },
        {
            icon: "lyric", title: t("panel.musicItemLyricOptions.toggleDesktopLyric", {
                status: Config.getConfig("lyric.showStatusBarLyric")
                    ? t("panel.musicItemLyricOptions.disableDesktopLyric")
                    : t("panel.musicItemLyricOptions.enableDesktopLyric"),
            }),
            async onPress() {
                const showStatusBarLyric = Config.getConfig("lyric.showStatusBarLyric");
                if (!showStatusBarLyric) {
                    const hasPermission =
                        await LyricUtil.checkSystemAlertPermission();

                    if (hasPermission) {
                        const statusBarLyricConfig = {
                            topPercent: Config.getConfig("lyric.topPercent"),
                            leftPercent: Config.getConfig("lyric.leftPercent"),
                            align: Config.getConfig("lyric.align"),
                            color: Config.getConfig("lyric.color"),
                            backgroundColor: Config.getConfig("lyric.backgroundColor"),
                            widthPercent: Config.getConfig("lyric.widthPercent"),
                            fontSize: Config.getConfig("lyric.fontSize"),
                        };
                        LyricUtil.showStatusBarLyric(
                            "MusicFree",
                            statusBarLyricConfig ?? {}
                        );
                        Config.setConfig("lyric.showStatusBarLyric", true);
                    } else {
                        LyricUtil.requestSystemAlertPermission().finally(() => {
                            Toast.warn(t("panel.musicItemLyricOptions.desktopLyricPermissionError"));
                        });
                    }
                } else {
                    LyricUtil.hideStatusBarLyric();
                    Config.setConfig("lyric.showStatusBarLyric", false);
                }
                hidePanel();
            },
        },
        {
            icon: "arrow-up-tray",
            title: t("panel.musicItemLyricOptions.uploadLocalLyric"),
            async onPress() {
                try {
                    const result = await getDocumentAsync({
                        copyToCacheDirectory: true,
                    });
                    if (result.canceled) {
                        return;
                    }
                    const pickedDoc = result.assets[0].uri;
                    const lyricContent = await readAsStringAsync(pickedDoc, {
                        encoding: "utf8",
                    });                    await lyricManager.uploadLocalLyric(musicItem, lyricContent);
                    Toast.success(t("toast.settingSuccess"));
                    hidePanel();
                } catch (e: any) {
                    console.log(e);
                    Toast.warn(t("panel.musicItemLyricOptions.settingFail", {
                        reason: e?.message,
                    }));
                }
            },
        },
        {
            icon: "arrow-up-tray",
            title: t("panel.musicItemLyricOptions.uploadLocalLyricTranslation"),
            async onPress() {
                try {
                    const result = await getDocumentAsync({
                        copyToCacheDirectory: true,
                    });
                    if (result.canceled) {
                        return;
                    }
                    const pickedDoc = result.assets[0].uri;
                    const lyricContent = await readAsStringAsync(pickedDoc, {
                        encoding: "utf8",
                    });                    await lyricManager.uploadLocalLyric(musicItem, lyricContent, "translation");
                    Toast.success(t("toast.settingSuccess"));
                    hidePanel();
                } catch (e: any) {
                    console.log(e);
                    Toast.warn(t("panel.musicItemLyricOptions.settingFail", {
                        reason: e?.message,
                    }));
                }
            },
        },
        {
            icon: "trash-outline",
            title: t("panel.musicItemLyricOptions.deleteLocalLyric"),
            async onPress() {
                try {
                    lyricManager.removeLocalLyric(musicItem);
                    hidePanel();
                } catch (e: any) {
                    console.log(e);
                    Toast.warn(t("panel.musicItemLyricOptions.deleteFail", {
                        reason: e?.message,
                    }));
                }
            },
        },
    ];

    return (
        <TvCardPanel            title="歌词选项"
            firstFocusName="lyricopt:0"
            width={rpx(520)}
            returnFocusName="tvplayer:toggle">
            <TvScrollView style={style.listWrapper}>
                {options
                    .filter(item => item.show !== false)
                    .map((item, index) => (
                        <TvFocusable
                            key={`lyricopt-${index}`}
                            name={`lyricopt:${index}`}
                            focusOrder={index}
                            style={style.row}
                            onPress={() => item.onPress?.()}>
                            <Icon
                                accessible={false}
                                name={item.icon}
                                size={rpx(38)}
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
    listWrapper: {
        width: "100%",
        maxHeight: rpx(330),
    },
    row: {
        width: "100%",
        height: rpx(84),
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(18),
        marginVertical: rpx(4),
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.06)",
    },
    rowText: {
        marginLeft: rpx(16),
        flexShrink: 1,
    },
});
