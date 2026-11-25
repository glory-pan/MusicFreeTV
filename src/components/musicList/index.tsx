import { RequestStateCode } from "@/constants/commonConst";
import TrackPlayer from "@/core/trackPlayer";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import rpx from "@/utils/rpx";
import { TvFlashList as FlashList } from "@/tv/scroll";
import React, { useRef, useCallback, useState, useEffect } from "react";
import { FlatListProps, StyleSheet, View } from "react-native";
import { TvPressable as Pressable } from "@/tv/components";
import ListEmpty from "../base/listEmpty";
import ListFooter from "../base/listFooter";
import MusicItem from "../mediaItem/musicItem";
import { isSameMediaItem } from "@/utils/mediaUtils";
import Icon from "../base/icon";
import { iconSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import { tvFocus } from "@/tv/focusStore";
import { lastKeyTs } from "@/tv/keyEvent";
import { useTvPageFirstFocus } from "@/tv/firstFocus";

interface IMusicListProps {
    /** 顶部 */
    Header?: FlatListProps<IMusic.IMusicItem>["ListHeaderComponent"];
    /** 音乐列表 */
    musicList?: IMusic.IMusicItem[];
    /** 所在歌单 */
    musicSheet?: IMusic.IMusicSheetItem;
    /** 是否展示序号 */
    showIndex?: boolean;
    /** 点击 */
    onItemPress?: (
        musicItem: IMusic.IMusicItem,
        musicList?: IMusic.IMusicItem[],
    ) => void;
    // 状态
    state: RequestStateCode;
    /** 高亮的音乐 */
    highlightMusicItem?: IMusic.IMusicItem | null;
    onRetry?: () => void;
    onLoadMore?: () => void;
}
const ITEM_HEIGHT = rpx(120);

/** 音乐列表 */
export default function MusicList(props: IMusicListProps) {
    const navigate = useNavigate();
    const goToPlayer = React.useCallback(() => {
        navigate(ROUTE_PATH.MUSIC_DETAIL);
    }, [navigate]);
    const {
        Header,
        musicList,
        musicSheet,
        showIndex,
        onItemPress,
        state,
        onRetry,
        onLoadMore,
        highlightMusicItem,
    } = props;    
    const colors = useColors();
    const flashListRef = useRef<any>(null);

    // 进歌单/榜单详情：数据到了就把光环放到第一首歌上（之前进页面完全没有焦点）
    React.useEffect(() => {
        if (!musicList?.length) {
            return;
        }
        // 只有在"屏幕上还没有光环"时才抢焦点：左侧信息卡的「播放全部」已经亮着就别抢
        if (!tvFocus.hasVisibleFocus()) {
            tvFocus.focusByName("song:0", true);
        }
        const timers = [300, 900, 1600].map(delay =>
            setTimeout(() => {
                // 用户正在按遥控器就别抢：否则按几下键，光环会被定时器打回第一首
                if (Date.now() - lastKeyTs < 500) {
                    return;
                }
                if (tvFocus.hasVisibleFocus()) {
                    return;
                }
                if (!tvFocus.focusByName("song:0", true)) {
                    tvFocus.focusFirstInActiveLayer();
                }
            }, delay),
        );
        return () => timers.forEach(clearTimeout);
    }, [musicList?.length]);
    useTvPageFirstFocus();
    const [showBadge, setShowBadge] = useState(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout>();

    // 查找高亮项的索引
    const highlightIndex = React.useMemo(() => {
        if (!highlightMusicItem || !musicList) return -1;
        return musicList.findIndex(item => isSameMediaItem(item, highlightMusicItem));
    }, [highlightMusicItem, musicList]);    
    
    // 处理滚动开始
    const handleScrollBegin = useCallback(() => {
        if (highlightIndex !== -1) {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
            setShowBadge(true);
        }
    }, [highlightIndex]);
    
    // 处理滚动结束
    const handleScrollEnd = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        // 5秒后直接隐藏
        hideTimeoutRef.current = setTimeout(() => {
            setShowBadge(false);
        }, 5000);
    }, []);    
    
    // 滚动到高亮项
    const scrollToHighlight = useCallback(() => {
        if (highlightIndex !== -1 && flashListRef.current) {
            flashListRef.current.scrollToIndex({
                index: highlightIndex,
                animated: false,
                viewPosition: 0,
            });
            // 立即隐藏角标
            setShowBadge(false);
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        }
    }, [highlightIndex]);    
    
    // 清理定时器
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, []);    
    
    return (
        <View style={styles.container}>
            <FlashList
                ref={flashListRef}
                ListHeaderComponent={Header}
                ListEmptyComponent={<ListEmpty state={state} onRetry={onRetry} />}
                ListFooterComponent={
                    musicList?.length ? <ListFooter state={state} onRetry={onRetry} /> : null
                }
                extraData={highlightMusicItem}
                data={musicList ?? []}
                estimatedItemSize={ITEM_HEIGHT}
                onScrollBeginDrag={handleScrollBegin}
                onScrollEndDrag={handleScrollEnd}
                onMomentumScrollEnd={handleScrollEnd}
                renderItem={({ index, item: musicItem }) => {
                    return (
                        <MusicItem
                            name={`song:${index}`}
                            focusOrder={index}
                            musicItem={musicItem}
                            hidePlatformTag
                            index={showIndex ? index + 1 : undefined}
                            onItemPress={() => {
                                if (onItemPress) {
                                    onItemPress(musicItem, musicList);
                                } else {
                                    TrackPlayer.playWithReplacePlayList(
                                        musicItem,
                                        musicList ?? [musicItem],
                                    );
                                    // 电视端：从列表点歌直接进播放页（遥控器不用再去点底部头像）
                                    goToPlayer();
                                }
                            }}
                            musicSheet={musicSheet}
                            highlight={isSameMediaItem(musicItem, highlightMusicItem)}
                        />
                    );
                }}
                onEndReached={() => {
                    if (state === RequestStateCode.IDLE || state === RequestStateCode.PARTLY_DONE) {
                        onLoadMore?.();
                    }
                }}
                onEndReachedThreshold={0.1}
            />              
            {showBadge && (
                <View style={styles.badge} pointerEvents="box-none">
                    <Pressable
                        style={[styles.badgeButton, { backgroundColor: colors.notification }]}
                        onPress={scrollToHighlight}
                    >
                        <Icon
                            name="crosshair"
                            size={iconSizeConst.normal}
                            color={colors.text}
                        />
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    badge: {
        position: "absolute",
        bottom: rpx(80),
        right: rpx(84),
        zIndex: 1000,
    },
    badgeButton: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(32),
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
});
