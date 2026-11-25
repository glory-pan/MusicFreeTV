import { ROUTE_PATH, useNavigate } from "@/core/router";
import React from "react";
import MusicItem from "@/components/mediaItem/musicItem";
import Config from "@/core/appConfig";
import { ISearchResult } from "@/pages/searchPage/store/atoms";
import TrackPlayer from "@/core/trackPlayer";

interface IMusicResultsProps {
    item: IMusic.IMusicItem;
    index: number;
    /** 遥控器焦点名 */
    name?: string;
    focusOrder?: number;
    pluginSearchResultRef: React.MutableRefObject<ISearchResult<"music">>;
}

export default function MusicResultItem(props: IMusicResultsProps) {
    const navigate = useNavigate();
    const { item: musicItem, name, focusOrder, pluginSearchResultRef } =
        props;

    return (
        <MusicItem
            name={name}
            focusOrder={focusOrder}
            musicItem={musicItem}
            onItemPress={() => {
                const clickBehavior = Config.getConfig(
                    "basic.clickMusicInSearch",
                );
                if (clickBehavior === "playMusicAndReplace") {
                    TrackPlayer.playWithReplacePlayList(
                        musicItem,
                        (pluginSearchResultRef?.current?.data ?? [
                            musicItem,
                        ]) as IMusic.IMusicItem[],
                    );
                } else {
                    TrackPlayer.play(musicItem);
                }
                navigate(ROUTE_PATH.MUSIC_DETAIL);
            }}
                    />
    );
}
