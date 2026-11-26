import React, { memo, useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { CircularProgressBase } from "react-native-circular-progress-indicator";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showPanel } from "../panels/usePanel";
import useColors from "@/hooks/useColors";
import IconButton from "../base/iconButton";
import TrackPlayer, { useCurrentMusic, useMusicState, useProgress } from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import MusicInfo from "./musicInfo";
import Icon from "@/components/base/icon.tsx";
import { ROUTE_PATH, useNavigate } from "@/core/router";

function CircularPlayBtn() {
    const progress = useProgress();
    const musicState = useMusicState();
    const colors = useColors();

    const isPaused = musicIsPaused(musicState);

    return (
        <CircularProgressBase
            activeStrokeWidth={rpx(4)}
            inActiveStrokeWidth={rpx(2)}
            inActiveStrokeOpacity={0.2}
            value={
                progress?.duration
                    ? (100 * progress.position) / progress.duration
                    : 0
            }
            duration={100}
            radius={rpx(36)}
            activeStrokeColor={colors.musicBarText}
            inActiveStrokeColor={colors.textSecondary}>
            <IconButton
                accessibilityLabel={"播放或暂停歌曲"}
                name={isPaused ? "play" : "pause"}
                sizeType={"normal"}
                hitSlop={{
                    top: 10,
                    left: 10,
                    right: 10,
                    bottom: 10,
                }}
                color={colors.musicBarText}
                onPress={async () => {
                    if (isPaused) {
                        await TrackPlayer.play();
                    } else {
                        await TrackPlayer.pause();
                    }
                }}
            />
        </CircularProgressBase>
    );
}
function MusicBar() {
    const musicItem = useCurrentMusic();
    const musicState = useMusicState();
    const navigate = useNavigate();

    const [showKeyboard, setKeyboardStatus] = useState(false);

    const colors = useColors();
    const safeAreaInsets = useSafeAreaInsets();

    useEffect(() => {
        const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
            setKeyboardStatus(true);
        });
        const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
            setKeyboardStatus(false);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    return (
        <>
            {musicItem && !showKeyboard && (
                <View
                    style={[
                        style.wrapper,
                        {
                            backgroundColor: colors.musicBar,
                            paddingRight: safeAreaInsets.right + rpx(24),
                        },
                    ]}>
                    <Pressable
                        style={style.infoArea}
                        onPress={() => {
                            navigate(ROUTE_PATH.MUSIC_DETAIL);
                        }}>
                        <MusicInfo musicItem={musicItem} />
                    </Pressable>
                    <View style={style.actionGroup}>
                        <Pressable
                            style={style.actionButton}
                            onPress={() => {
                                TrackPlayer.skipToPrevious();
                            }}>
                            <Icon
                                accessible={false}
                                name="skip-left"
                                size={rpx(52)}
                                color={colors.musicBarText}
                            />
                        </Pressable>
                        <Pressable
                            style={style.actionButton}
                            onPress={() => {
                                if (musicIsPaused(musicState)) {
                                    TrackPlayer.play();
                                } else {
                                    TrackPlayer.pause();
                                }
                            }}>
                            <Icon
                                accessible={false}
                                name={musicIsPaused(musicState) ? "play" : "pause"}
                                size={rpx(52)}
                                color={colors.musicBarText}
                            />
                        </Pressable>
                        <Pressable
                            style={style.actionButton}
                            onPress={() => {
                                TrackPlayer.skipToNext();
                            }}>
                            <Icon
                                accessible={false}
                                name="skip-right"
                                size={rpx(52)}
                                color={colors.musicBarText}
                            />
                        </Pressable>
                        <Pressable
                            style={style.actionButton}
                            onPress={() => {
                                showPanel("PlayList");
                            }}>
                            <Icon
                                accessible={false}
                                name="playlist"
                                size={rpx(56)}
                                color={colors.musicBarText}
                            />
                        </Pressable>
                    </View>
                </View>
            )}
        </>
    );
}

export default memo(MusicBar, () => true);

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: rpx(90),
        flexDirection: "row",
        alignItems: "center",
        paddingRight: rpx(24),
    },
    actionGroup: {
        width: rpx(340),
        justifyContent: "flex-end",
        flexDirection: "row",
        alignItems: "center",
    },
    actionIcon: {
        marginLeft: rpx(36),
    },
    infoArea: {
        flex: 1,
        height: "100%",
        justifyContent: "center",
    },
    actionButton: {
        width: rpx(84),
        height: rpx(84),
        borderRadius: rpx(14),
        alignItems: "center",
        justifyContent: "center",
        marginLeft: rpx(12),
    },
});
