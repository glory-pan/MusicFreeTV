import React, { useEffect, useRef } from "react";
import { Keyboard } from "react-native";
import TrackPlayer, { useMusicState, useProgress } from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import { tvFocus } from "./focusStore";
import { ROUTE_PATH } from "@/core/router";
import { tvNavigate } from "./navigateBridge";
import { ITvKeyEvent, setDpadCapture, subscribeTvKey, TvKey } from "./keyEvent";

type KeyInterceptor = (key: TvKey, action: "down" | "up") => boolean;

const interceptors = new Set<KeyInterceptor>();

/**
 * 页面级按键拦截：先于焦点引擎处理（例如播放页的左右键 = 快退/快进）。
 * 返回 true 表示已消费该按键。
 */
export function useTvKeys(handler: KeyInterceptor) {
    useEffect(() => {
        interceptors.add(handler);
        return () => {
            interceptors.delete(handler);
        };
    }, [handler]);
}

const SEEK_STEP = 15;

function handleMediaKey(key: TvKey, isPaused: boolean, position: number) {
    switch (key) {
        case "playPause":
            if (isPaused) {
                TrackPlayer.play();
            } else {
                TrackPlayer.pause();
            }
            return true;
        case "play":
            TrackPlayer.play();
            return true;
        case "pause":
            TrackPlayer.pause();
            return true;
        case "next":
            TrackPlayer.skipToNext();
            return true;
        case "previous":
            TrackPlayer.skipToPrevious();
            return true;
        case "stop":
            TrackPlayer.pause();
            return true;
        case "forward":
            TrackPlayer.seekTo(Math.max(0, position + SEEK_STEP));
            return true;
        case "rewind":
            TrackPlayer.seekTo(Math.max(0, position - SEEK_STEP));
            return true;
        default:
            return false;
    }
}

/**
 * 电视端全局按键分发：遥控器事件 → 页面拦截器 → 焦点引擎 / 媒体控制。
 */
export function TvProvider(props: { children?: React.ReactNode }) {
    useEffect(() => {
        tvFocus.startWatchdog();
        return () => {
            tvFocus.stopWatchdog();
        };
    }, []);

    const musicState = useMusicState();
    const progress = useProgress(1000);

    const stateRef = useRef({ musicState, progress });
    stateRef.current = { musicState, progress };

    useEffect(() => {
        const onEvent = (event: ITvKeyEvent) => {
            const { musicState: state, progress: pg } = stateRef.current;
            const isPaused = musicIsPaused(state);
            const position = (pg?.position as number) ?? 0;

            if (event.action === "up") {
                if (event.key === "center") {
                    const consumed = [...interceptors].some(item =>
                        item(event.key, "up"),
                    );
                    if (!consumed) {
                        tvFocus.endPress();
                    }
                } else {
                    [...interceptors].forEach(item => item(event.key, "up"));
                }
                return;
            }

            // down：页面拦截器优先（MV 播放页需要用自己的媒体键语义）
            const consumed = [...interceptors].some(item =>
                item(event.key, "down"),
            );
            if (consumed) {
                return;
            }

            if (handleMediaKey(event.key, isPaused, position)) {
                return;
            }

            switch (event.key) {
                case "up":
                case "down":
                case "left":
                case "right": {
                    tvFocus.move(event.key);
                    // 按了方向键却还是看不到光环（焦点卡在上一页残留节点上）：
                    // 直接点亮本页第一个元素，绝不让用户陷入"怎么按都没反应"
                    setTimeout(() => {
                        if (!tvFocus.hasVisibleFocus()) {
                            tvFocus.focusFirstInActiveLayer();
                        }
                    }, 380);
                    break;
                }
                case "center":
                    tvFocus.beginLongPress();
                    break;
                case "menu": {
                    // 任意页面按 MENU 键直达播放页：电视上没有鼠标，
                    // 在歌单/列表里也需要一个稳定的"回到当前播放"路径。
                    tvNavigate(ROUTE_PATH.MUSIC_DETAIL);
                    break;
                }
                default:
                    break;
            }
        };

        const unsubscribe = subscribeTvKey(onEvent);

        // 输入法弹出时把方向键交还系统，保证输入框可以正常编辑
        const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
            setDpadCapture(false);
        });
        const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
            setDpadCapture(true);
        });

        return () => {
            unsubscribe();
            showSubscription.remove();
            hideSubscription.remove();
            setDpadCapture(true);
        };
    }, []);

    return <>{props.children}</>;
}
