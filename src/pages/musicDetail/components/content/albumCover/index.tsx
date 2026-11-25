import React, { useEffect, useMemo, useRef } from "react";
import rpx, { vh } from "@/utils/rpx";
import { ImgAsset } from "@/constants/assetsConst";
import FastImage from "@/components/base/fastImage";
import useOrientation from "@/hooks/useOrientation";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Animated, Easing } from "react-native";
import { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import globalStyle from "@/constants/globalStyle";
import { View } from "react-native";
import { showPanel } from "@/components/panels/usePanel.ts";

interface IProps {
    onTurnPageClick?: () => void;
}

export default function AlbumCover(props: IProps) {
    const { onTurnPageClick } = props;

    const musicItem = useCurrentMusic();
    const musicState = useMusicState();
    const paused = musicIsPaused(musicState);
    const spin = useRef(new Animated.Value(0)).current;
    const spinValue = useRef(0);

    // 旋转动画只创建一次，播放/暂停只做 start/stop。
    // 以前每次依赖变化都重建 loop，播放中会从当前角度重新开始，
    // 表现就是"要么只转到半圈，要么明明在播却不转"。
    const animRef = useRef<any>(null);
    useEffect(() => {
        if (!animRef.current) {
            animRef.current = Animated.loop(
                Animated.timing(spin, {
                    toValue: 1,
                    duration: 9000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                { resetBeforeIteration: true },
            );
        }
        if (paused) {
            animRef.current.stop();
        } else {
            animRef.current.start();
        }
    }, [paused, spin]);

    useEffect(() => {
        return () => {
            animRef.current?.stop?.();
        };
    }, []);
    const orientation = useOrientation();

    const artworkStyle = useMemo(() => {
        if (orientation === "vertical") {
            return {
                width: rpx(360),
                height: rpx(360),
            };
        } else {
            // 封面再放大一档，配合缩小的谱条/控制区，比例更大气
            const size = vh(30);
            return {
                width: size,
                height: size,
            };
        }
    }, [orientation]);

    const longPress = Gesture.LongPress()
        .onStart(() => {
            if (musicItem?.artwork) {
                showPanel("ImageViewer", {
                    url: musicItem.artwork,
                });
            }
        })
        .runOnJS(true);

    const tap = Gesture.Tap()
        .onStart(() => {
            onTurnPageClick?.();
        })
        .runOnJS(true);

    const combineGesture = Gesture.Race(tap, longPress);

    return (
        <>
            <GestureDetector gesture={combineGesture}>
                <View style={[globalStyle.fullCenter, styles.coverWrap]}>
                    <Animated.View
                        style={{
                            transform: [
                                {
                                    rotate: spin.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ["0deg", "360deg"],
                                    }),
                                },
                            ],
                        }}>
                        <FastImage
                            style={[
                                artworkStyle,
                                {
                                    borderRadius: 9999,
                                    borderWidth: rpx(6),
                                    borderColor: "rgba(255,255,255,0.16)",
                                },
                            ]}
                            source={musicItem?.artwork}
                            placeholderSource={ImgAsset.albumDefault}
                        />
                    </Animated.View>
                </View>
            </GestureDetector>
        </>
    );
}

const styles = StyleSheet.create({
    coverWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: vh(1.6),
    },
});
