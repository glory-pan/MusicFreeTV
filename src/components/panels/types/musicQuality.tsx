import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import { qualityKeys, qualityText } from "@/utils/qualities";
import { sizeFormatter } from "@/utils/fileUtils";
import { TvFocusable } from "@/tv/components";
import TvCardPanel from "../base/tvCardPanel";
import { hidePanel } from "../usePanel";
import { useI18N } from "@/core/i18n";
import Toast from "@/utils/toast";

interface IMusicQualityProps {
    type?: "play" | "download";
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
    /** 点击回调 */
    onQualityPress: (
        quality: IMusic.IQualityKey,
        musicItem: IMusic.IMusicItem,
    ) => void;
    /** 关闭卡片后把光环还给打开它的那个图标 */
    returnFocusName?: string;
}

/**
 * 音质选择：电视端卡片式浮层，一行一个音质，
 * 光环贴着每一行按钮本身，不再是一条把整块面板涂满的大框。
 */
export default function MusicQuality(props: IMusicQualityProps) {
    const i18n = useI18N();
    const {
        musicItem,
        onQualityPress,
        type = "play",
        returnFocusName = "tvops:quality",
    } = props ?? {};

    return (
        <TvCardPanel
            title={i18n.t("panel.musicQuality.title", {
                type:
                    type === "play"
                        ? i18n.t("common.play")
                        : i18n.t("common.download"),
            })}
            firstFocusName="quality:0"
            returnFocusName={returnFocusName}>
            <View style={style.list}>
                {qualityKeys.map((key, index) => {
                    const quality = musicItem.qualities?.[key];
                    const available = !!quality?.url;
                    return (
                        <TvFocusable
                            key={`quality-${key}`}
                            name={`quality:${index}`}
                            focusOrder={index}
                            style={[
                                style.row,
                                available
                                    ? style.rowAvailable
                                    : style.rowDisabled,
                            ]}
                            onPress={() => {
                                // 全部可选：很多插件都不回传每个音质的大小，
                                // 用"有没有 url"判断可用会把四项全判死（用户实机就点不动）
                                onQualityPress(key, musicItem);
                                hidePanel();
                            }}>
                            <ThemeText fontSize="subTitle" style={style.rowTitle}>
                                {qualityText[key]}
                            </ThemeText>
                            <ThemeText
                                fontSize="description"
                                fontColor={available ? "textSecondary" : "textSecondary"}>
                                {quality?.size
                                    ? sizeFormatter(quality.size)
                                    : qualityText[key]}
                            </ThemeText>
                        </TvFocusable>
                    );
                })}
            </View>
        </TvCardPanel>
    );
}

const style = StyleSheet.create({
    list: {
        width: "100%",
        gap: rpx(12),
        paddingBottom: rpx(6),
    },
    row: {
        width: "100%",
        height: rpx(78),
        paddingHorizontal: rpx(20),
        borderRadius: rpx(12),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    rowAvailable: {
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    rowDisabled: {
        backgroundColor: "rgba(255,255,255,0.03)",
    },
    rowTitle: {
        flexShrink: 1,
    },
});
