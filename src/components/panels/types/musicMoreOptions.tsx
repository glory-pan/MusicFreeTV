import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { IIconName } from "@/components/base/icon.tsx";
import { TvFocusable } from "@/tv/components";
import TvCardPanel from "../base/tvCardPanel";
import { hidePanel, showPanel } from "../usePanel";
import TrackPlayer from "@/core/trackPlayer";
import PersistStatus from "@/utils/persistStatus";
import LocalMusicSheet from "@/core/localMusicSheet";
import downloader from "@/core/downloader";
import Toast from "@/utils/toast";

interface IMusicMoreOptionsProps {
    musicItem: IMusic.IMusicItem;
}

/**
 * 播放页「⋯ 更多」的电视端卡片：
 * 只保留倍速播放 / 下载歌曲两项（去掉了手机端的"查看歌曲详情/评论"）。
 * 一行一个操作，光环正好套住每一行，不再是整块抽屉的大框。
 */
export default function MusicMoreOptions(props: IMusicMoreOptionsProps) {
    const { musicItem } = props;
    const rate = PersistStatus.useValue("music.rate", 100);
    const isDownloaded = LocalMusicSheet.useIsLocal(musicItem);

    const items: Array<{
        key: string;
        title: string;
        desc?: string;
        icon: IIconName;
        onPress: () => void;
    }> = [
        {
            key: "rate",
            title: "倍速播放",
            desc: `${((rate ?? 100) / 100).toFixed(2).replace(/\.?0+$/, "")}x`,
            icon: "play",
            onPress: () => {
                showPanel("PlayRate", {
                    async onRatePress(newRate: number) {
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
            title: isDownloaded ? "已下载" : "下载歌曲",
            desc: isDownloaded ? "已在本机" : "选择音质后下载",
            icon: "arrow-down-tray",
            onPress: () => {
                if (isDownloaded) {
                    Toast.success("该歌曲已下载");
                    return;
                }
                showPanel("MusicQuality", {
                    type: "download",
                    musicItem,
                    async onQualityPress(quality: any) {
                        downloader.download(musicItem, quality);
                    },
                });
            },
        },
    ];

    return (
        <TvCardPanel
            title="更多"
            firstFocusName="more:0"
            returnFocusName="tvops:more">
            <View style={style.list}>
                {items.map((item, index) => (
                    <TvFocusable
                        key={item.key}
                        name={`more:${index}`}
                        focusOrder={index}
                        style={style.row}
                        onPress={item.onPress}>
                        <Icon
                            accessible={false}
                            name={item.icon}
                            size={rpx(32)}
                            color="#ffffff"
                        />
                        <View style={style.rowText}>
                            <ThemeText fontSize="subTitle">{item.title}</ThemeText>
                        </View>
                        {item.desc ? (
                            <ThemeText
                                fontSize="description"
                                fontColor="textSecondary"
                                numberOfLines={1}>
                                {item.desc}
                            </ThemeText>
                        ) : null}
                    </TvFocusable>
                ))}
            </View>
        </TvCardPanel>
    );
}

const style = StyleSheet.create({
    list: {
        width: "100%",
        gap: rpx(12),
        paddingBottom: rpx(4),
    },
    row: {
        width: "100%",
        height: rpx(84),
        paddingHorizontal: rpx(20),
        borderRadius: rpx(12),
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    rowText: {
        flex: 1,
        marginLeft: rpx(18),
    },
});
