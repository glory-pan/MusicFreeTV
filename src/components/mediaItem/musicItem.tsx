import React, { useEffect, useId, useState } from "react";
import {
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";
import rpx from "@/utils/rpx";
import ListItem from "../base/listItem";

import LocalMusicSheet from "@/core/localMusicSheet";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import { showPanel } from "../panels/usePanel";
import TitleAndTag from "./titleAndTag";
import ThemeText from "../base/themeText";
import TrackPlayer from "@/core/trackPlayer";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import FastImage from "@/components/base/fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import { TvTouchableOpacity as TouchableOpacity } from "@/tv/components";
import Toast from "@/utils/toast";
import downloader from "@/core/downloader";
import { getMvBadge, requestMvBadge, subscribeMvBadge } from "@/core/mvBadge";

interface IMusicItemProps {
    index?: string | number;
    showMoreIcon?: boolean;
    /** 关掉行右侧的三个动作图标（默认开启） */
    showActions?: boolean;
    musicItem: IMusic.IMusicItem;
    musicSheet?: IMusic.IMusicSheetItem;
    onItemPress?: (musicItem: IMusic.IMusicItem) => void;
    onItemLongPress?: () => void;
    itemPaddingRight?: number;
    left?: () => JSX.Element;
    containerStyle?: StyleProp<ViewStyle>;
    highlight?: boolean;
    /** 遥控器焦点名（列表返回时按名字把光环放回原来那一行） */
    name?: string;
    /** 歌单/榜单详情里不显示平台标签（每首歌都挂个"蓝克音乐"太吵） */
    hidePlatformTag?: boolean;
    focusOrder?: number;
}

/**
 * 歌曲行（电视版）。
 *
 * 结构上把"整行"和"行尾的动作"拆成了**并列的焦点节点**：
 *
 *   [ 封面 · 标题 · 歌手 ]   (♡) 收藏   (+) 加入歌单   (↓) 下载
 *
 * 之前动作图标是套在整行 Pressable 里的无名节点，光环落不到它身上、
 * 几何导航也进不去，遥控器根本按不到。现在每个图标都是独立命名节点
 * （`${name}:fav` / `:add` / `:dl`），行内左右用显式链接串起来，
 * 上下靠同列对齐走，遥控器四向都能到达。
 */
export default function MusicItem(props: IMusicItemProps) {
    const {
        musicItem,
        index,
        onItemPress,
        onItemLongPress,
        musicSheet,
        itemPaddingRight,
        showActions = true,
        left: Left,
        containerStyle,
        highlight = false,
        name,
        focusOrder,
        hidePlatformTag = false,
    } = props;

    const rid = useId();
    // 没传 name 的地方也要有唯一前缀，否则图标节点无名、光环画不出来
    const base = name ?? `mi${rid.replace(/[^a-zA-Z0-9]/g, "")}`;

    const favored = useFavorite(musicItem);
    // 这首歌有没有 MV（绿色小标）：先读缓存，没结果就排进全局低并发队列
    const [hasMv, setHasMv] = useState<boolean | undefined>(() =>
        (musicItem as any)?.hasMv === true
            ? true
            : getMvBadge(musicItem),
    );
    // 有些源回来的条目没有 title（只有 artist / album），标题列会空一大块。
    // 兜底顺序：title → album → "歌手 - 专辑"，保证这一行永远有歌名可看。
    const itemTitle =
        musicItem.title ||
        musicItem.album ||
        [musicItem.artist, musicItem.album].filter(Boolean).join(" - ");
    const itemDesc = musicItem.title
        ? `${musicItem.artist ?? ""}${
              musicItem.album ? ` - ${musicItem.album}` : ""
          }`
        : (musicItem.artist ?? "");
    useEffect(() => {
        setHasMv(getMvBadge(musicItem));
        requestMvBadge(musicItem);
        return subscribeMvBadge(() => {
            const value = getMvBadge(musicItem);
            if (value !== undefined) {
                setHasMv(value);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [musicItem?.id, musicItem?.platform]);
    const [pendingFav, setPendingFav] = useState<boolean | null>(null);

    useEffect(() => {
        setPendingFav(null);
    }, [favored]);

    const isFav = pendingFav ?? favored;

    const toggleFavorite = () => {
        const next = !isFav;
        // 先切图标，再落库：点一下就一定有反馈
        setPendingFav(next);
        try {
            if (next) {
                MusicSheet.addMusic("favorite", musicItem);
                Toast.success("已收藏到「我喜欢」");
            } else {
                MusicSheet.removeMusic("favorite", musicItem);
                Toast.success("已取消收藏");
            }
        } catch (e: any) {
            setPendingFav(null);
            Toast.warn(e?.message ?? "收藏失败");
        }
    };

    const downloaded = LocalMusicSheet.isLocalMusic(musicItem);

    const actions: Array<{
        key: string;
        icon: IIconName;
        color: string;
        bg: string;
        onPress: () => void;
    }> = showActions
        ? [
              {
                  key: "fav",
                  icon: isFav ? "heart" : "heart-outline",
                  color: isFav ? "#ff4f7b" : "#e6f1ff",
                  bg: isFav
                      ? "rgba(255,79,123,0.18)"
                      : "rgba(255,255,255,0.08)",
                  onPress: toggleFavorite,
              },
              {
                  key: "add",
                  icon: "folder-plus",
                  color: "#8fd0ff",
                  bg: "rgba(95,208,255,0.14)",
                  onPress: () =>
                      showPanel("AddToMusicSheet", {
                          musicItem,
                          returnFocusName: `${base}:add`,
                      }),
              },
              {
                  key: "dl",
                  icon: downloaded ? "check-circle" : "arrow-down-tray",
                  color: downloaded ? "#7ee0a8" : "#c9dcff",
                  bg: downloaded
                      ? "rgba(126,224,168,0.14)"
                      : "rgba(255,255,255,0.08)",
                  onPress: () => {
                      showPanel("MusicQuality", {
                          musicItem,
                          type: "download",
                          returnFocusName: `${base}:dl`,
                          onQualityPress(quality: any) {
                              downloader.download(musicItem, quality);
                          },
                      });
                  },
              },
          ]
        : [];

    return (
        <View style={[styles.row, containerStyle]}>
            {/* 这里的包裹层是关键：ListItem 内部容器是 width:100%，
                直接放在横排里会把行尾的图标整排挤出可视区（实机就是"没有图标"） */}
            <View style={styles.main}>
                <ListItem
                    name={base}
                    focusOrder={focusOrder}
                    heightType="normal"
                    withHorizontalPadding
                leftPadding={index !== undefined ? 0 : undefined}
                rightPadding={itemPaddingRight ?? rpx(10)}
                rightName={actions.length ? `${base}:fav` : undefined}
                onLongPress={
                    onItemLongPress ??
                    (() =>
                        showPanel("MusicItemOptions", {
                            musicItem,
                            musicSheet,
                        }))
                }
                onPress={() => {
                    if (onItemPress) {
                        onItemPress(musicItem);
                    } else {
                        TrackPlayer.play(musicItem);
                    }
                }}>
                {Left ? <Left /> : null}
                {index !== undefined ? (
                    <ListItem.ListItemText
                        width={rpx(82)}
                        position="none"
                        fixedWidth
                        fontColor={highlight ? "primary" : "text"}
                        contentStyle={styles.indexText}>
                        {index}
                    </ListItem.ListItemText>
                ) : null}
                {musicItem.artwork ? (
                    <View>
                        <FastImage
                            source={musicItem.artwork}
                            placeholderSource={ImgAsset.albumDefault}
                            style={styles.artwork}
                        />
                        {hasMv ? (
                            <View style={styles.mvCorner}>
                                <Text style={styles.mvCornerText}>MV</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}
                <ListItem.Content
                    title={
                        <View style={styles.titleRow}>
                            <View style={styles.titleTextWrap}>
                                <TitleAndTag
                                    title={itemTitle}
                                    titleFontColor={
                                        highlight ? "primary" : "text"
                                    }
                                />
                            </View>
                            {hasMv ? (
                                <View style={styles.mvBadge}>
                                    <Text style={styles.mvBadgeText}>MV</Text>
                                </View>
                            ) : null}
                        </View>
                    }
                    description={
                        <View style={styles.descContainer}>
                            {downloaded && (
                                <Icon
                                    style={styles.icon}
                                    color="#11659a"
                                    name="check-circle"
                                    size={rpx(22)}
                                />
                            )}
                            {itemDesc ? (
                                <ThemeText
                                    numberOfLines={1}
                                    fontSize="description"
                                    fontColor={
                                        highlight ? "primary" : "textSecondary"
                                    }>
                                    {itemDesc}
                                </ThemeText>
                            ) : null}
                        </View>
                    }
                />
                </ListItem>
            </View>

            {actions.length ? (
                <View style={styles.actions}>
                    {actions.map((action, actionIndex) => {
                        const actionName = `${base}:${action.key}`;
                        const prevName =
                            actionIndex === 0
                                ? base
                                : `${base}:${actions[actionIndex - 1].key}`;
                        const nextName =
                            actionIndex < actions.length - 1
                                ? `${base}:${actions[actionIndex + 1].key}`
                                : undefined;
                        return (
                            <TouchableOpacity
                                key={action.key}
                                name={actionName}
                                focusOrder={focusOrder}
                                leftName={prevName}
                                rightName={nextName}
                                onPress={action.onPress}
                                style={[
                                    styles.actionBtn,
                                    { backgroundColor: action.bg },
                                ]}>
                                <Icon
                                    accessible={false}
                                    name={action.icon}
                                    size={rpx(32)}
                                    color={action.color}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        minWidth: 0,
    },
    titleTextWrap: {
        // 关键：这里必须是 flex:1。
        // 原来是 flexShrink:1（宽度由内容撑开），而 TitleAndTag 里的标题是 flex:1（basis 0），
        // 在"宽度由内容决定"的容器里量出来就是 0 → 歌名永远渲染成 0 宽、看不见，
        // 列表里只剩「歌手 - 专辑」那一行，看着就像没有歌名。
        flex: 1,
        minWidth: 0,
    },
    mvCorner: {
        position: "absolute",
        left: rpx(4),
        top: rpx(4),
        paddingHorizontal: rpx(6),
        height: rpx(26),
        borderRadius: rpx(5),
        backgroundColor: "rgba(0,0,0,0.72)",
        borderWidth: rpx(1.5),
        borderColor: "#2ecc71",
        alignItems: "center",
        justifyContent: "center",
    },
    mvCornerText: {
        color: "#3ee07f",
        fontSize: rpx(17),
        fontWeight: "700",
        lineHeight: rpx(21),
    },
    mvBadge: {
        marginLeft: rpx(10),
        paddingHorizontal: rpx(10),
        height: rpx(30),
        borderRadius: rpx(6),
        borderWidth: rpx(1.5),
        borderColor: "#2ecc71",
        backgroundColor: "rgba(46,204,113,0.20)",
        alignItems: "center",
        justifyContent: "center",
    },
    mvBadgeText: {
        color: "#3ee07f",
        fontSize: rpx(20),
        fontWeight: "700",
        lineHeight: rpx(26),
    },
    icon: {
        marginRight: rpx(6),
    },
    descContainer: {
        flexDirection: "row",
        marginTop: rpx(16),
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: rpx(116),
        marginHorizontal: rpx(8),
        marginBottom: rpx(10),
        paddingRight: rpx(16),
        borderRadius: rpx(16),
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: rpx(1),
        borderColor: "rgba(140,190,255,0.14)",
    },
    main: {
        flex: 1,
        minWidth: 0,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
    },
    actionBtn: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(32),
        marginLeft: rpx(16),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    indexText: {
        fontStyle: "italic",
        textAlign: "center",
        padding: rpx(2),
    },
    artwork: {
        width: rpx(88),
        height: rpx(88),
        borderRadius: rpx(12),
        marginRight: rpx(18),
        backgroundColor: "rgba(255,255,255,0.06)",
    },
});
