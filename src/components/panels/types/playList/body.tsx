import React, { useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TvPressable as Pressable } from "@/tv/components";
import rpx from "@/utils/rpx";
import Tag from "@/components/base/tag";
import ThemeText from "@/components/base/themeText";
import { fontSizeConst } from "@/constants/uiConst";
import { isSameMediaItem } from "@/utils/mediaUtils";
import IconButton from "@/components/base/iconButton";
import Loading from "@/components/base/loading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useColors from "@/hooks/useColors";
import TrackPlayer, { useCurrentMusic, usePlayList } from "@/core/trackPlayer";
import { TvFlashList as FlashList } from "@/tv/scroll";
import Icon from "@/components/base/icon.tsx";
import { PagerHint, usePager, usePagerKeys } from "@/tv/pager";

/** 一页 8 首：卡片里一屏能完整显示，靠翻页走完 100 首 */
const PAGE_SIZE = 5;

const ITEM_HEIGHT = rpx(108);
const ITEM_WIDTH = "100%";

interface IPlayListProps {
    item: IMusic.IMusicItem;
    isCurrentMusic: boolean;
    index: number;
}

function _PlayListItem(props: IPlayListProps) {
    const colors = useColors();
    const { item, isCurrentMusic, index } = props;

    return (
        <Pressable
            name={`playlist:${index}`}
            focusOrder={index}
            onPress={() => {
                TrackPlayer.play(item);
            }}
            style={style.musicItem}>
            {isCurrentMusic && (
                <Icon
                    name="musical-note"
                    color={colors.textHighlight ?? colors.primary}
                    size={fontSizeConst.content}
                    style={style.currentPlaying}
                />
            )}
            <ThemeText
                style={[
                    style.musicItemTitle,
                    {
                        color: isCurrentMusic
                            ? colors.textHighlight ?? colors.primary
                            : colors.text,
                    },
                ]}
                ellipsizeMode="tail"
                numberOfLines={1}>
                {item.title}
                {item.artist && (
                    <Text style={{ fontSize: fontSizeConst.description }}>
                        {" "}
                        - {item.artist}
                    </Text>
                )}
            </ThemeText>
            <Tag tagName={item.platform} />
            <IconButton
                style={{ marginLeft: rpx(14) }}
                name="x-mark"
                sizeType="small"
                onPress={() => {
                    TrackPlayer.remove(item);
                }}
            />
        </Pressable>
    );
}

const PlayListItem = React.memo(
    _PlayListItem,
    (prev, next) =>
        !!isSameMediaItem(prev.item, next.item) &&
        prev.isCurrentMusic === next.isCurrentMusic &&
        prev.index === next.index,
);

interface IBodyProps {
    loading?: boolean;
}
export default function Body(props: IBodyProps) {
    const { loading } = props;
    const playList = usePlayList();
    const currentMusicItem = useCurrentMusic();
    const listRef = useRef<any>(null);
    const safeAreaInsets = useSafeAreaInsets();

    const pager = usePager(playList.length, PAGE_SIZE);
    usePagerKeys("playlist", pager, pager.goNext, pager.goPrev);

    const initIndex = useMemo(() => {
        const id = playList.findIndex(_ =>
            isSameMediaItem(currentMusicItem, _),
        );

        if (id !== -1) {
            return id;
        }
        return undefined;
    }, []);

    const renderItem = ({ item, index }: { item: IMusic.IMusicItem; index: number }) => {
        return (
            <PlayListItem
                item={item}
                index={index}
                isCurrentMusic={!!isSameMediaItem(item, currentMusicItem)}
            />
        );
    };

    return loading ? (
        <Loading />
    ) : (
        <View
            style={[
                style.playList,
                {
                    paddingBottom: safeAreaInsets.bottom,
                },
            ]}>
            {/* 卡片里用普通滚动列表：FlashList 在卡片内量不到高度会渲染成一片空白 */}
            <View style={style.listInner}>
                {playList
                    .slice(pager.start, pager.end)
                    .map((item, offset) => {
                        const index = pager.start + offset;
                        return (
                            <PlayListItem
                                key={`${index}-${item.platform ?? ""}-${item.id ?? ""}`}
                                item={item}
                                index={index}
                                isCurrentMusic={!!isSameMediaItem(
                                    item,
                                    currentMusicItem,
                                )}
                            />
                        );
                    })}
            </View>
            <PagerHint
                page={pager.page}
                pages={pager.pages}
                start={pager.start}
                end={pager.end}
                total={pager.total}
            />
        </View>
    );
}

const style = StyleSheet.create({
    playList: {
        width: "100%",
    },
    listInner: {
        width: "100%",
    },
    currentPlaying: {
        marginRight: rpx(6),
    },
    musicItem: {
        width: ITEM_WIDTH,
        height: ITEM_HEIGHT,
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
    },
    musicItemTitle: {
        flex: 1,
    },
});
