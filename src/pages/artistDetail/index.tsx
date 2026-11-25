import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import MusicBar from "@/components/musicBar";
import Header from "./components/header";
import Body from "./components/body";
import { useAtom, useSetAtom } from "jotai";
import { initQueryResult, queryResultAtom, scrollToTopAtom } from "./store/atoms";
import { ROUTE_PATH, useNavigate, useParams } from "@/core/router";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import useOrientation from "@/hooks/useOrientation";
import { isTvBuild } from "@/tv/keyEvent";
import { useTvPageFirstFocus } from "@/tv/firstFocus";
import { tvFocus } from "@/tv/focusStore";
import AppBar from "@/components/base/appBar";
import { useI18N } from "@/core/i18n";

export default function ArtistDetail() {
    const [queryResult, setQueryResult] = useAtom(queryResultAtom);
    const { artistItem } = useParams<"artist-detail">();
    const setScrollToTopState = useSetAtom(scrollToTopAtom);
    const navigate = useNavigate();
    const orientation = useOrientation();
    const { t } = useI18N();

    // 进页面就把光环放到「单曲」页签上：这一页之前完全没有焦点（遥控器按不动）。
    // 节点在查询数据返回后才陆续注册，所以用"待定焦点"，注册即点亮。
    useEffect(() => {
        if (!isTvBuild) {
            return;
        }
        tvFocus.focusByName("artist:tab:music", true);
    }, []);
    useTvPageFirstFocus(isTvBuild);

    useEffect(() => {
        return () => {
            setQueryResult(initQueryResult);
            setScrollToTopState(true);
        };
    }, []);

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <AppBar
                withStatusBar
                menu={[
                    {
                        title: t("artistDetail.menu.batchEditMusic"),
                        icon: "pencil-square",
                        onPress() {
                            navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                                musicList: queryResult?.music?.data ?? [],
                                musicSheet: {
                                    title: t("artistDetail.musicSheet", {
                                        artist: artistItem.name,
                                    }),
                                },
                            });
                        },
                    },
                ]}>
                {t("common.artist")}
            </AppBar>
            <View
                style={
                    orientation === "horizontal" || isTvBuild
                        ? style.horizontal
                        : globalStyle.flex1
                }>
                <Header neverFold={orientation === "horizontal"} />
                <Body />
            </View>

            <MusicBar />
        </VerticalSafeAreaView>
    );
}

const style = StyleSheet.create({
    horizontal: {
        flexDirection: "row",
        flex: 1,
    },
});
