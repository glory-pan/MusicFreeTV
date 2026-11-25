import { DeviceEventEmitter, NativeModules, Platform } from "react-native";

/** 遥控器按键名（与原生命中键值一一对应） */
export type TvKey =
    | "up"
    | "down"
    | "left"
    | "right"
    | "center"
    | "menu"
    | "playPause"
    | "play"
    | "pause"
    | "next"
    | "previous"
    | "forward"
    | "rewind"
    | "stop";

export interface ITvKeyEvent {
    key: TvKey;
    action: "down" | "up";
}

interface ITvRemoteNative {
    setDpadCapture(enabled: boolean): void;
}

const nativeModule = (NativeModules as any).TvRemote as
    | ITvRemoteNative
    | undefined;

/** 是否运行在「具备遥控器按键桥」的 Android TV 构建上 */
export const isTvBuild = Platform.OS === "android" && !!nativeModule;

/**
 * 输入框唤起系统输入法时，方向键要交还给系统（否则光标无法移动）。
 */
export function setDpadCapture(capture: boolean) {
    try {
        nativeModule?.setDpadCapture(capture);
    } catch {
        // 非 TV 环境静默忽略
    }
}

/** 长按需要连续触发的方向键 */
const REPEATABLE: TvKey[] = ["up", "down", "left", "right"];
/** 长按多久开始连续走（毫秒） */
const REPEAT_DELAY = 340;
/** 连续走的步进间隔（毫秒） */
const REPEAT_INTERVAL = 110;

/**
 * 订阅遥控器按键。
 *
 * 原生只把第一次按下（repeatCount=0）报上来，长按不放就再也不会有事件，
 * 所以这里自己做长按连发：按住不放 → 先等 340ms，然后每 110ms 再发一次同方向按键，
 * 松手（收到 up）立刻停。方向键是唯一的连发对象，OK/菜单/媒体键不连发。
 */
export function subscribeTvKey(listener: (event: ITvKeyEvent) => void) {
    if (!nativeModule) {
        return () => {};
    }
    const starters = new Map<string, any>();
    const timers = new Map<string, any>();
    const stopOne = (key: string) => {
        const starter = starters.get(key);
        if (starter) {
            clearTimeout(starter);
            starters.delete(key);
        }
        const timer = timers.get(key);
        if (timer) {
            clearInterval(timer);
            timers.delete(key);
        }
    };
    const stopAll = () => {
        Array.from(starters.keys()).forEach(stopOne);
        Array.from(timers.keys()).forEach(stopOne);
        starters.clear();
        timers.clear();
    };
    const subscription = DeviceEventEmitter.addListener(
        "TvRemoteKey",
        (event: ITvKeyEvent) => {
            const key = event?.key;
            if (!key) {
                return;
            }
            if (event.action === "up") {
                stopOne(key);
                listener(event);
                return;
            }
            if (event.action !== "down") {
                listener(event);
                return;
            }
            // 按下另一个键：先停掉之前所有连发，避免两个方向同时跑
            stopAll();
            listener(event);
            if (REPEATABLE.indexOf(key) < 0) {
                return;
            }
            const starter = setTimeout(() => {
                starters.delete(key);
                if (!timers.has(key)) {
                    timers.set(
                        key,
                        setInterval(() => {
                            listener({ key, action: "down" });
                        }, REPEAT_INTERVAL),
                    );
                }
            }, REPEAT_DELAY);
            starters.set(key, starter);
        },
    );
    return () => {
        stopAll();
        subscription.remove();
    };
}
