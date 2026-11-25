import React from "react";
import NavBar from "./components/navBar";
import MusicBar from "@/components/musicBar";
import SheetMusicList from "./components/sheetMusicList";
import StatusBar from "@/components/base/statusBar";
import globalStyle from "@/constants/globalStyle";
import VerticalSafeAreaView from "../base/verticalSafeAreaView";
import { RequestStateCode } from "@/constants/commonConst";
import { StyleSheet, View } from "react-native";
import { isTvBuild } from "@/tv/keyEvent";
import TvSheetHeader from "../tvSheetHeader";

interface IMusicSheetPageProps {
    navTitle: string;
    sheetInfo: ICommon.WithMusicList<IMusic.IMusicSheetItemBase> | null;
    musicList?: IMusic.IMusicItem[] | null;
    // 是否可收藏
    canStar?: boolean;
    // 状态
    state: RequestStateCode;
    onRetry?: () => void;
    onLoadMore?: () => void;
}

const styles = StyleSheet.create({
    row: {
        flex: 1,
        flexDirection: "row",
    },
});

export default function MusicSheetPage(props: IMusicSheetPageProps) {
    const { navTitle, sheetInfo, musicList, canStar, onLoadMore, onRetry, state } =
        props;

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <NavBar
                musicList={musicList ?? sheetInfo?.musicList ?? []}
                navTitle={navTitle}
            />
            <View style={isTvBuild ? styles.row : globalStyle.flex1}>
                {isTvBuild ? (
                    <TvSheetHeader
                        canStar={canStar}
                        musicSheet={sheetInfo as any}
                        musicList={(musicList ?? sheetInfo?.musicList) as any}
                    />
                ) : null}
                <SheetMusicList
                    canStar={canStar}
                    hideHeader={isTvBuild}
                    sheetInfo={sheetInfo as any}
                    musicList={musicList ?? sheetInfo?.musicList}
                    state={state}
                    onRetry={onRetry}
                    onLoadMore={onLoadMore}
                />
            </View>
            <MusicBar />
        </VerticalSafeAreaView>
    );
}
