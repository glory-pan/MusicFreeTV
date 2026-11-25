import React from "react";
import { StyleSheet, View } from "react-native";
import { TvScrollView } from "@/tv/scroll";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import FastImage from "@/components/base/fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import { TvFocusable } from "@/tv/components";
import Icon from "@/components/base/icon";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import MusicSheet, { useSheetIsStarred } from "@/core/musicSheet";
import { MusicRepeatMode } from "@/constants/repeatModeConst";
import { showPanel } from "@/components/panels/usePanel";
import Toast from "@/utils/toast";

interface ITvSheetHeaderProps {
    musicSheet?: IMusic.IMusicSheetItem | ICommon.WithMusicList<IMusic.IMusicSheetItemBase> | null;
    musicList?: IMusic.IMusicItem[] | null;
    canStar?: boolean;
}

/**
 * 歌单详情页左侧信息卡（电视版）。
 *
 * 原来详情页顶部是一张"满屏宽"的手机式大卡（大封面 + 一大段简介 + 播放全部），
 * 在电视上它吃掉半屏，下面只剩三行歌，遥控器还得先跨过整片区域。
 * 现在固定成左栏一张竖卡：封面 / 标题 / 曲目数 / 简介（限行）/ 操作按钮，
 * 右侧整块留给歌曲列表 —— 和作者页同一套版式。
 *
 * 所有按钮都是命名焦点节点，上下用显式链接串起来，最下面的「编辑」按下键直接进列表第一行。
 */
export default function TvSheetHeader(props: ITvSheetHeaderProps) {
    const { musicSheet, musicList, canStar } = props ?? {};
    const navigate = useNavigate();

    const sheetInfo = musicSheet as IMusic.IMusicSheetItem | null;
    const starred = useSheetIsStarred(sheetInfo);
    const count =
        musicList?.length ?? sheetInfo?.worksNum ?? sheetInfo?.musicList?.length ?? 0;

    const playAll = () => {
        if (!musicList?.length) {
            return;
        }
        let first = musicList[0];
        if (TrackPlayer.repeatMode === MusicRepeatMode.SHUFFLE) {
            first = musicList[Math.floor(Math.random() * musicList.length)];
        }
        TrackPlayer.playWithReplacePlayList(first, musicList);
    };

    const buttons: Array<{
        name: string;
        icon?: any;
        label: string;
        onPress: () => void;
        primary?: boolean;
        show?: boolean;
    }> = [
        {
            name: "sh:playall",
            icon: "play-circle",
            label: "播放全部",
            onPress: playAll,
            primary: true,
        },
        {
            name: "sh:star",
            icon: starred ? "heart" : "heart-outline",
            label: starred ? "已收藏歌单" : "收藏歌单",
            show: !!canStar && !!sheetInfo,
            onPress: () => {
                try {
                    if (!starred) {
                        MusicSheet.starMusicSheet(sheetInfo as any);
                        Toast.success("已收藏歌单");
                    } else {
                        MusicSheet.unstarMusicSheet(sheetInfo as any);
                        Toast.success("已取消收藏歌单");
                    }
                } catch (e: any) {
                    Toast.warn(e?.message ?? "操作失败");
                }
            },
        },
        {
            name: "sh:add",
            icon: "folder-plus",
            label: "整张加入歌单",
            onPress: () =>
                showPanel("AddToMusicSheet", {
                    musicItem: musicList ?? [],
                    newSheetDefaultName: sheetInfo?.title,
                }),
        },
        {
            name: "sh:edit",
            icon: "pencil-square",
            label: "批量编辑",
            onPress: () =>
                navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                    musicList: musicList ?? [],
                    musicSheet: {
                        title: sheetInfo?.title,
                        id: sheetInfo?.id,
                    },
                } as any),
        },
    ];

    const visibleButtons = buttons.filter(it => it.show !== false);

    return (
        <View style={styles.wrapper}>
            <TvScrollView style={styles.scroll}>
            <View style={styles.coverWrap}>
                <FastImage
                    style={styles.cover}
                    source={sheetInfo?.artwork ?? sheetInfo?.coverImg}
                    placeholderSource={ImgAsset.albumDefault}
                />
                <ThemeText
                    fontSize="title"
                    fontWeight="bold"
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    style={styles.title}>
                    {sheetInfo?.title ?? ""}
                </ThemeText>
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    style={styles.count}>
                    {`共 ${count} 首`}
                </ThemeText>
                {sheetInfo?.description ? (
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        numberOfLines={5}
                        ellipsizeMode="tail"
                        style={styles.desc}>
                        {sheetInfo.description}
                    </ThemeText>
                ) : null}
            </View>

            <View style={styles.actions}>
                {visibleButtons.map((btn, index) => (
                    <TvFocusable
                        key={btn.name}
                        name={btn.name}
                        focusOrder={index}
                        upName={
                            index > 0 ? visibleButtons[index - 1].name : undefined
                        }
                        downName={
                            index < visibleButtons.length - 1
                                ? visibleButtons[index + 1].name
                                : "song:0"
                        }
                        style={[
                            styles.btn,
                            btn.primary ? styles.btnPrimary : null,
                        ]}
                        onPress={btn.onPress}>
                        {btn.icon ? (
                            <Icon
                                accessible={false}
                                name={btn.icon}
                                size={rpx(34)}
                                color={btn.primary ? "#0b1622" : "#e8f4ff"}
                                style={styles.btnIcon}
                            />
                        ) : null}
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            style={btn.primary ? styles.btnLabelPrimary : null}>
                            {btn.label}
                        </ThemeText>
                    </TvFocusable>
                ))}
            </View>
            </TvScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: rpx(380),
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRightWidth: rpx(1),
        borderRightColor: "rgba(140,190,255,0.14)",
    },
    scroll: {
        flex: 1,
        paddingHorizontal: rpx(14),
        paddingTop: rpx(16),
        paddingBottom: rpx(14),
    },
    coverWrap: {
        width: "100%",
    },
    cover: {
        width: "100%",
        height: rpx(240),
        borderRadius: rpx(16),
        backgroundColor: "rgba(255,255,255,0.06)",
    },
    title: {
        marginTop: rpx(16),
    },
    count: {
        marginTop: rpx(6),
    },
    desc: {
        marginTop: rpx(10),
        lineHeight: rpx(28),
    },
    actions: {
        marginTop: rpx(14),
    },
    btn: {
        flexDirection: "row",
        alignItems: "center",
        height: rpx(62),
        paddingHorizontal: rpx(16),
        marginBottom: rpx(9),
        borderRadius: rpx(31),
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    btnPrimary: {
        backgroundColor: "#5fd0ff",
    },
    btnIcon: {
        marginRight: rpx(12),
    },
    btnLabelPrimary: {
        color: "#0b1622",
    },
});
