import { ROUTE_PATH, useNavigate } from "@/core/router";
import React from "react";
import { View } from "react-native";

import Loading from "@/components/base/loading";
import Header from "./header";
import MusicList from "@/components/musicList";
import Config from "@/core/appConfig";
import globalStyle from "@/constants/globalStyle";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import TrackPlayer from "@/core/trackPlayer";
import { RequestStateCode } from "@/constants/commonConst";

interface IMusicListProps {
    sheetInfo: IMusic.IMusicSheetItem | null;
    musicList?: IMusic.IMusicItem[] | null;
    // 是否可收藏
    canStar?: boolean;
    // 状态
    state: RequestStateCode;
    onRetry?: () => void;
    onLoadMore?: () => void;
    /** 电视版：信息卡已经放在左侧，列表里不再重复渲染头部 */
    hideHeader?: boolean;
}
export default function SheetMusicList(props: IMusicListProps) {
    const navigate = useNavigate();
    const {
        sheetInfo,
        musicList,
        canStar,
        state,
        onRetry,
        onLoadMore,
        hideHeader,
    } = props;

    return (
        <View style={globalStyle.fwflex1}>
            {!musicList ? (
                <Loading />
            ) : (
                <HorizontalSafeAreaView style={globalStyle.fwflex1}>
                    <MusicList
                        showIndex
                        Header={
                            hideHeader ? null : (
                                <Header
                                    canStar={canStar}
                                    musicSheet={sheetInfo}
                                    musicList={musicList}
                                />
                            )
                        }
                        onLoadMore={onLoadMore}
                        onRetry={onRetry}
                        state={state}
                        musicList={musicList}
                        onItemPress={(musicItem, currentMusicList) => {
                            if (
                                Config.getConfig(
                                    "basic.clickMusicInAlbum",
                                ) === "playMusic"
                            ) {
                                TrackPlayer.play(musicItem);
                            } else {
                                TrackPlayer.playWithReplacePlayList(
                                    musicItem,
                                    currentMusicList ?? [musicItem],
                                );
                            }
                            // 电视端：点歌后直接进入播放页（遥控器无需再去点头像）
                            navigate(ROUTE_PATH.MUSIC_DETAIL);
                        }}
                    />
                </HorizontalSafeAreaView>
            )}
        </View>
    );
}
