import React from "react";
import NavBar from "./components/navBar";
import MusicBar from "@/components/musicBar";
import SheetMusicList from "./components/sheetMusicList";
import StatusBar from "@/components/base/statusBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import { View } from "react-native";
import { useParams } from "@/core/router";
import { useSheetItem } from "@/core/musicSheet";
import { isTvBuild } from "@/tv/keyEvent";
import TvSheetHeader from "@/components/tvSheetHeader";

export default function SheetDetail() {
    const { id = "favorite" } = useParams<"local-sheet-detail">();
    const sheet = useSheetItem(id);

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <NavBar />
            <View style={isTvBuild ? style.row : globalStyle.flex1}>
                {isTvBuild ? (
                    <TvSheetHeader
                        musicSheet={sheet}
                        musicList={sheet?.musicList}
                    />
                ) : null}
                <SheetMusicList hideHeader={isTvBuild} />
            </View>
            <MusicBar />
        </VerticalSafeAreaView>
    );
}

const style = {
    row: {
        flex: 1,
        flexDirection: "row" as const,
    },
};
