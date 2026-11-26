import React, {
    createContext,
    forwardRef,
    useCallback,
    useContext,
    useEffect,
    useImperativeHandle,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";
import {
    Pressable as RNPressable,
    TextInput as RNTextInput,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";
import { ITvFocusNodeOptions } from "./focusStore";
import { tvFocus } from "./focusStore";
import { TvRect } from "./types";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";

/** 浮层图层：弹窗 / 面板 / 抽屉挂载后，焦点自动进入该层 */
const TvLayerContext = createContext<number>(1);

/** 页面作用域：每个屏幕/浮层一份，节点注册时就读到它，避免"切页时序"问题 */
const TvScopeContext = createContext<number>(0);

/**
 * 包一个页面或浮层：挂载即成为"当前作用域"，卸载后退回上一层。
 * 节点归属靠 context（注册那一刻就正确），不依赖导航事件的先后。
 */
export function TvScope(props: { children?: React.ReactNode; strict?: boolean }) {
    const scope = useMemo(() => tvFocus.createScope(), []);
    const strict = !!props.strict;
    useEffect(() => {
        tvFocus.pushScope(scope, strict);
        return () => {
            tvFocus.popScope(scope);
        };
    }, [scope, strict]);
    return (
        <TvScopeContext.Provider value={scope}>
            {props.children}
        </TvScopeContext.Provider>
    );
}

export function TvFocusLayer(props: {
    children?: React.ReactNode;
    /** 图层建好后回调，面板据此只在"自己这一层"挑首焦点 */
    onReady?: (layer: number) => void;
}) {
    const layer = useMemo(() => {
        const created = tvFocus.createLayer();
        // 浮层在 render 阶段就把"面板会话"打开：这一步一定早于里面任何按钮的注册，
        // 所以第一个注册的按钮必然被点亮。页面层同样适用（进页面即有光环）。
        tvFocus.openPanelSession();
        return created;
    }, []);
    useEffect(() => {
        props.onReady?.(layer);
    }, [layer]);
    // 浮层同时也是独立作用域：焦点只在浮层里走，不会漏到背后的页面
    // 页面/浮层挂上之后自愈：只要屏幕上还看不到光环，就把本层第一个可聚焦元素点亮。
    // 三种时机（进页面、返回页面、浮层关闭）布局完成时间不同，所以分三次复查。
    useEffect(() => {
        const timers = [200, 500, 1000].map(delay =>
            setTimeout(() => {
                if (!tvFocus.hasVisibleFocus()) {
                    tvFocus.focusFirstInActiveLayer();
                }
            }, delay),
        );
        return () => timers.forEach(timer => clearTimeout(timer));
    }, []);
    return (
        <TvScope strict>
            <TvLayerContext.Provider value={layer}>
                {props.children}
            </TvLayerContext.Provider>
        </TvScope>
    );
}

interface IUseTvFocusableParams {
    ref: React.RefObject<any>;
    onPress?: (event?: any) => void;
    onLongPress?: () => void;
    disabled?: boolean;
    debugName?: string;
    order?: number;
    /** 显式方向链接：按 debugName 指名该方向的目标节点 */
    leftName?: string;
    rightName?: string;
    upName?: string;
    downName?: string;
}

/**
 * 把一个原生组件注册成遥控器焦点节点。
 */
function useTvFocusable(params: IUseTvFocusableParams) {
    const layer = useContext(TvLayerContext);
    const scope = useContext(TvScopeContext);
    const idRef = useRef<number | null>(null);
    const [focusTick, bumpFocusTick] = useReducer((x: number) => x + 1, 0);
    const latest = useRef(params);
    latest.current = params;

    useEffect(() => {
        const id = tvFocus.register({
            debugName: params.debugName,
            measure: (callback: (rect: TvRect | null) => void) => {
                const target = latest.current.ref.current;
                if (!target || typeof target.measureInWindow !== "function") {
                    callback(null);
                    return;
                }
                target.measureInWindow(
                    (x: number, y: number, width: number, height: number) => {
                        callback({ x, y, width, height });
                    },
                );
            },
            onPress: () => latest.current.onPress?.(),
            onLongPress: () => latest.current.onLongPress?.(),
            disabled: !!latest.current.disabled,
            order: latest.current.order,
            leftName: latest.current.leftName,
            rightName: latest.current.rightName,
            upName: latest.current.upName,
            downName: latest.current.downName,
            layer,
            scope,
        });
        idRef.current = id;
        const unsubscribe = tvFocus.subscribeNodeFocus(id, bumpFocusTick);
        return () => {
            unsubscribe();
            tvFocus.unregister(id);
            idRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layer, scope]);

    useEffect(() => {
        if (idRef.current != null) {
            tvFocus.update(idRef.current, { disabled: !!params.disabled });
        }
    }, [params.disabled, params.onPress, params.onLongPress]);

    const isFocused = idRef.current != null && tvFocus.isFocused(idRef.current);
    // focusTick 仅用于触发重渲染
    void focusTick;
    return { isFocused };
}

/**
 * 声明本页面使用「序列导航」：方向键按焦点顺序一格格走，
 * 不再依赖 measureInWindow 的坐标（坐标在面板/列表/裁剪场景下并不可靠）。
 */
export function useTvOrderMode() {
    useEffect(() => {
        tvFocus.setOrderMode(true);
        return () => {
            tvFocus.setOrderMode(false);
        };
    }, []);
}


/**
 * 全局焦点光环（浮层兜底）。
 *
 * 之前的方案是"每个可聚焦元素自己画一个边框"，但个别容器（列表懒加载、
 * 面板动画中、被裁剪的卡片）在聚焦时不触发重渲染，光环就看不到 ——
 * 用户看到的现象是"进去没有光环，要乱按几下才偶然出现一个"。
 * 这里再加一层浮层：订阅焦点变化 + 每 250ms 重新测量当前焦点，
 * 只要引擎有焦点，屏幕上就一定有可见的光环。
 */
export function TvFocusOverlay() {
    const [rect, setRect] = useState<TvRect | null>(null);

    useEffect(() => {
        let alive = true;
        const update = () => {
            if (!alive) {
                return;
            }
            const r = tvFocus.getFocusedRect();
            setRect(
                r && r.width > 1 && r.height > 1
                    ? { x: r.x, y: r.y, width: r.width, height: r.height }
                    : null,
            );
        };
        const unsubscribe = tvFocus.subscribeRing(update);
        const timer = setInterval(() => {
            tvFocus.remeasureFocused();
            update();
        }, 250);
        update();
        return () => {
            alive = false;
            unsubscribe();
            clearInterval(timer);
        };
    }, []);

    if (!rect) {
        return null;
    }

    return (
        <View
            pointerEvents="none"
            style={[
                styles.globalRing,
                {
                    left: rect.x - 4,
                    top: rect.y - 4,
                    width: rect.width + 8,
                    height: rect.height + 8,
                },
            ]}
        />
    );
}

/**
 * 焦点框：直接画在被聚焦元素内部，不再依赖"窗口坐标 → 全局浮层"的换算，
 * 因此列表滚动、弹层、页面切换后都不会出现错位。
 */
function focusBorderStyle(color: string) {
    return {
        borderColor: color,
        backgroundColor: colorWithAlpha(color, 0.06),
    };
}

const styles = StyleSheet.create({
    globalRing: {
        position: "absolute",
        borderWidth: 3,
        borderRadius: 10,
        borderColor: "#4fc3ff",
        backgroundColor: "rgba(79,195,255,0.08)",
        zIndex: 9999,
        elevation: 12,
    },
    inputFocused: {
        // 输入框也要有看得见的光环：亮青描边 + 轻微放大，
        // 否则用户根本判断不出"焦点现在在搜索框里"
        borderWidth: rpx(2),
        borderColor: "#7fe9ff",
        transform: [{ scale: 1.02 }],
    },
    focusGlow: {
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        borderWidth: 6,
        borderRadius: 16,
    },
    focusBorder: {
        position: "absolute",
        left: 5,
        top: 5,
        right: 5,
        bottom: 5,
        borderWidth: 2,
        borderRadius: 12,
    },
});

export function TvFocusBorder(props: { radius?: number }) {
    const colors = useColors();
    const color = colors?.primary ?? "#ffffff";
    return (
        <>
            <View
                pointerEvents="none"
                style={[
                    styles.focusGlow,
                    props.radius != null
                        ? { borderRadius: props.radius + 4 }
                        : null,
                    { borderColor: colorWithAlpha(color, 0.28) },
                ]}
            />
            <View
                pointerEvents="none"
                style={[
                    styles.focusBorder,
                    props.radius != null
                        ? { borderRadius: props.radius }
                        : null,
                    focusBorderStyle(color),
                ]}
            />
        </>
    );
}

/** 焦点态视觉：轻微放大（高亮框由 TvFocusBorder 在元素内部绘制） */
const focusedStyle: ViewStyle = {
    transform: [{ scale: 1.03 }],
    zIndex: 2,
};

function mergeStyle(style: any, focused: boolean) {
    if (!focused) {
        return style;
    }
    if (typeof style === "function") {
        return (state: any) => [style(state), focusedStyle];
    }
    return [style, focusedStyle];
}


/** Pressable 的 style：合并原 style + 按下反馈 + 焦点放大 */
function pressableStyle(
    style: any,
    focused: boolean,
    pressedVisual: { opacity?: number; backgroundColor?: string },
) {
    return (state: any) => {
        const pressed = state?.pressed;
        return [
            typeof style === "function" ? style(state) : style,
            pressed && pressedVisual.opacity ? { opacity: pressedVisual.opacity } : null,
            pressed && pressedVisual.backgroundColor
                ? { backgroundColor: pressedVisual.backgroundColor }
                : null,
            focused ? focusedStyle : null,
        ];
    };
}

export const TvTouchableOpacity = forwardRef<any, any>(
    function TvTouchableOpacity(props, ref) {
        const {
            onPress,
            onLongPress,
            disabled,
            style,
            children,
            activeOpacity = 0.85,
            name,
            focusOrder,
            leftName,
            rightName,
            upName,
            downName,
            ...rest
        } = props;
        const innerRef = useRef<any>(null);
        useImperativeHandle(ref, () => innerRef.current);
        const { isFocused } = useTvFocusable({
            ref: innerRef,
            onPress,
            onLongPress,
            disabled,
            debugName: name,
            order: focusOrder,
            leftName,
            rightName,
            upName,
            downName,
        });

        // 用 Pressable 而不是 TouchableOpacity：后者内部要求"只能有一个子元素"，
        // 多画一个焦点框就会抛 React.Children.only。
        return (
            <RNPressable
                {...rest}
                ref={innerRef}
                disabled={disabled}
                onPress={onPress}
                onLongPress={onLongPress}
                style={pressableStyle(style, isFocused, {
                    opacity: activeOpacity,
                })}>
                {children}
                {isFocused ? <TvFocusBorder /> : null}
            </RNPressable>
        );
    },
);

export const TvPressable = forwardRef<any, any>(
    function TvPressable(props, ref) {
        const {
            onPress,
            onLongPress,
            disabled,
            style,
            children,
            name,
            focusOrder,
            ...rest
        } = props;
        const innerRef = useRef<any>(null);
        useImperativeHandle(ref, () => innerRef.current);
        const { isFocused } = useTvFocusable({
            ref: innerRef,
            onPress,
            onLongPress,
            disabled,
            debugName: name,
            order: focusOrder,
        });

        return (
            <RNPressable
                {...rest}
                ref={innerRef}
                disabled={disabled}
                style={mergeStyle(style, isFocused)}
                onPress={onPress}
                onLongPress={onLongPress}>
                {children}
                {isFocused ? <TvFocusBorder /> : null}
            </RNPressable>
        );
    },
);

export const TvTouchableHighlight = forwardRef<any, any>(
    function TvTouchableHighlight(props, ref) {
        const {
            onPress,
            onLongPress,
            disabled,
            style,
            children,
            name,
            focusOrder,
            leftName,
            rightName,
            upName,
            downName,
            ...rest
        } = props;
        const innerRef = useRef<any>(null);
        useImperativeHandle(ref, () => innerRef.current);
        const { isFocused } = useTvFocusable({
            ref: innerRef,
            onPress,
            onLongPress,
            disabled,
            debugName: name,
            order: focusOrder,
            leftName,
            rightName,
            upName,
            downName,
        });

        return (
            <RNPressable
                {...rest}
                ref={innerRef}
                disabled={disabled}
                onPress={onPress}
                onLongPress={onLongPress}
                style={pressableStyle(style, isFocused, {
                    backgroundColor: props.underlayColor,
                })}>
                {children}
                {isFocused ? <TvFocusBorder /> : null}
            </RNPressable>
        );
    },
);

/** 包一层 View 的可聚焦容器：给 Icon / SVG 等没有 ref 能力的元素使用。 */
export function TvFocusable(props: {
    children?: React.ReactNode;
    onPress?: (event?: any) => void;
    onLongPress?: (event?: any) => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    /** 供页面级按键拦截识别（如进度条、MV 播放页） */
    name?: string;
    /** 显式焦点顺序（序列模式下按它排序） */
    focusOrder?: number;
    /** 显式方向链接：按 debugName 指名该方向的目标节点 */
    leftName?: string;
    rightName?: string;
    upName?: string;
    downName?: string;
    /** 焦点光环圆角：贴边的小按钮传一个较大值会变成胶囊形，看起来更协调 */
    focusRadius?: number;
    /** 不要焦点框，改成聚焦时垫一层淡色底（图标按钮上更干净） */
    noRing?: boolean;
    /** 配 noRing 用的底色 */
    focusBackground?: string;
}) {
    const {
        children,
        onPress,
        onLongPress,
        disabled,
        style,
        name,
        focusOrder,
        leftName,
        rightName,
        upName,
        downName,
        focusRadius,
        noRing,
        focusBackground,
    } = props;
    const innerRef = useRef<any>(null);
    const { isFocused } = useTvFocusable({
        ref: innerRef,
        onPress,
        onLongPress,
        disabled,
        debugName: name,
        order: focusOrder,
        leftName,
        rightName,
        upName,
        downName,
    });

    return (
        <View
            ref={innerRef}
            style={[
                style,
                isFocused ? focusedStyle : null,
                isFocused && noRing && focusBackground
                    ? { backgroundColor: focusBackground, borderRadius: 999 }
                    : null,
            ]}>
            {children}
            {isFocused && !noRing ? (
                <TvFocusBorder radius={focusRadius} />
            ) : null}
        </View>
    );
}

/**
 * 无触摸反馈的可点击区域（列表行、Tab 等），电视上同时接受 OK 键。
 */
export const TvTouchableWithoutFeedback = forwardRef<any, any>(
    function TvTouchableWithoutFeedback(props, ref) {
        const { onPress, onLongPress, disabled, style, children, ...rest } =
            props;
        const innerRef = useRef<any>(null);
        useImperativeHandle(ref, () => innerRef.current);
        const { isFocused } = useTvFocusable({
            ref: innerRef,
            onPress,
            onLongPress,
            disabled,
        });

        const onTouchEnd = useCallback(() => {
            if (!disabled) {
                onPress?.();
            }
        }, [disabled, onPress]);

        return (
            <View
                {...rest}
                ref={innerRef}
                style={mergeStyle(style, isFocused)}
                onTouchEnd={onTouchEnd}>
                {children}
                {isFocused ? <TvFocusBorder /> : null}
            </View>
        );
    },
);

/**
 * 电视端输入框：遥控器按 OK 时唤起系统输入法，输入法弹出期间方向键交还系统。
 */
export const TvTextInput = forwardRef<any, any>(function TvTextInput(
    props,
    ref,
) {
    const innerRef = useRef<any>(null);
    useImperativeHandle(ref, () => innerRef.current);
    const {
        name,
        focusOrder,
        style: inputStyle,
        onFocus: propsOnFocus,
        onBlur: propsOnBlur,
        ...rest
    } = props;

    // 遥控器焦点落进输入框时只是"选中"，不弹键盘（客厅里没人想在走路路过输入框时
    // 就被软键盘挡住半个屏幕）。只有真正按下 OK 键才进入编辑态、拉起键盘。
    const [editing, setEditing] = useState(false);

    const { isFocused } = useTvFocusable({
        ref: innerRef,
        onPress: () => setEditing(true),
        debugName: name,
        order: focusOrder,
    });

    useEffect(() => {
        if (editing) {
            const timer = setTimeout(() => {
                innerRef.current?.focus?.();
            }, 60);
            return () => clearTimeout(timer);
        }
        innerRef.current?.blur?.();
        return undefined;
    }, [editing]);

    useEffect(() => {
        if (!isFocused && editing) {
            setEditing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFocused]);

    return (
        <RNTextInput
            {...rest}
            ref={innerRef}
            // Android：软键盘只在编辑态才弹，避免"光环一到位就顶出键盘"
            showSoftInputOnFocus={editing}
            onFocus={e => {
                setEditing(true);
                propsOnFocus?.(e);
            }}
            onBlur={e => {
                setEditing(false);
                propsOnBlur?.(e);
            }}
            style={[inputStyle, isFocused ? styles.inputFocused : null]}
        />
    );
});

function colorWithAlpha(color: string, alpha: number) {
    if (!color) {
        return `rgba(255,255,255,${alpha})`;
    }
    if (color.startsWith("#")) {
        const hex = color.slice(1);
        const full =
            hex.length === 3
                ? hex
                      .split("")
                      .map(item => item + item)
                      .join("")
                : hex;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    if (color.startsWith("rgb")) {
        return color.replace(/rgba?\(([^)]+)\)/, (_m, inner) => {
            const parts = inner.split(",").slice(0, 3).join(",");
            return `rgba(${parts},${alpha})`;
        });
    }
    return `rgba(255,255,255,${alpha})`;
}

export const TvLayerProvider = TvLayerContext.Provider;
