import StatusBar from "@/components/base/statusBar";
import globalStyle from "@/constants/globalStyle";
import useOrientation from "@/hooks/useOrientation";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Background from "./components/background";
import Bottom from "./components/bottom";
import TvPlayerPanel from "./components/tvPlayerPanel";
import EqualizerOverlay from "@/pages/equalizer/overlay";
import Content from "./components/content";
import Lyric from "./components/content/lyric";
import NavBar from "./components/navBar";
import Config from "@/core/appConfig";
import TrackPlayer, { useCurrentMusic, useProgress } from "@/core/trackPlayer";
import { prefetchMusicVideo } from "@/core/mvPrefetch";
import { tvFocus, useTvKeys } from "@/tv";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import TvErrorBoundary from "@/components/base/tvErrorBoundary";

export default function MusicDetail() {
    const [showEq, setShowEq] = React.useState(false);
    const orientation = useOrientation();
    const progress = useProgress(500);
    const currentMusic = useCurrentMusic();

    // 进播放页就把这首的 MV 在后台解析好，按「视频」时直接命中缓存
    useEffect(() => {
        if (!currentMusic) {
            return;
        }
        // 越早开始解析越好：用户从播放页点"视频"往往是 5~10 秒之后，
        // 提前预取能把"正在解析 MV"这段等待吃掉大半。
        const timer = setTimeout(() => prefetchMusicVideo(currentMusic), 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMusic?.id]);

    // 电视端：进度条获得焦点时，左右键直接快退/快进（手机上是拖动滑块）
    useTvKeys(key => {
        const focused = tvFocus.getFocusedNode();
        if (!focused || focused.debugName !== "seek") {
            return false;
        }
        if (key === "left" || key === "right") {
            const delta = key === "left" ? -10 : 10;
            const current = (progress?.position as number) ?? 0;
            TrackPlayer.seekTo(Math.max(0, current + delta));
            return true;
        }
        return false;
    });

    useEffect(() => {
        const needAwake = Config.getConfig("basic.musicDetailAwake");
        if (needAwake) {
            activateKeepAwakeAsync();
        }
        return () => {
            if (needAwake) {
                deactivateKeepAwake();
            }
        };
    }, []);

    return (
        <TvErrorBoundary title="歌曲播放页">
        <View style={globalStyle.fwflex1}>
            <Background />
            <SafeAreaView style={globalStyle.fwflex1}>
                <StatusBar backgroundColor={"transparent"} />
                <View style={style.bodyWrapper}>
                    <View style={globalStyle.flex1}>
                        <NavBar />
                        <Content />
                        <TvPlayerPanel onOpenEqualizer={() => setShowEq(true)} />
                    </View>
                    {orientation === "horizontal" ? (
                        <View style={globalStyle.flex1}>
                            <Lyric />
                        </View>
                    ) : null}
                </View>
                <EqualizerOverlay visible={showEq} onClose={() => setShowEq(false)} />
            </SafeAreaView>
        </View>
        </TvErrorBoundary>
    );
}

const style = StyleSheet.create({
    bodyWrapper: {
        width: "100%",
        flex: 1,
        flexDirection: "row",
    },
});
