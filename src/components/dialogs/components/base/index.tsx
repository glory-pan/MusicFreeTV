import React, { ReactNode, useEffect, useMemo, useRef } from "react";
import { BackHandler, NativeEventSubscription, Pressable as RNPressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { TvFocusable } from "@/tv/components";
import rpx, { vh, vw } from "@/utils/rpx";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { timingConfig } from "@/constants/commonConst";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import Divider from "@/components/base/divider";
import { fontSizeConst } from "@/constants/uiConst";
import { TvScrollView as ScrollView } from "@/tv/scroll";
import useOrientation from "@/hooks/useOrientation.ts";
import { tvFocus } from "@/tv/focusStore";
import { TvFocusLayer } from "@/tv/components";

interface IDialogProps {
    onDismiss?: () => void;
    children?: ReactNode;
    /** 首焦点优先给到这个带 name 的元素（找不到再回落到图层内第一个） */
    firstFocusName?: string;
}

function Dialog(props: IDialogProps) {
    const { children, onDismiss, firstFocusName } = props;

    const sharedShowValue = useSharedValue(0);
    const colors = useColors();
    const backHandlerRef = useRef<NativeEventSubscription>();
    const orientation = useOrientation();

    // 对话框宽度
    // 电视端弹框：固定宽度的居中卡片（内容再多也不会摊成一整块大板）
    const dialogContainerStyle: ViewStyle = {
        width: Math.min(vw(64), rpx(720)),
    };
    void orientation;

    useEffect(() => {
        sharedShowValue.value = 1;
        if (backHandlerRef.current) {
            backHandlerRef.current?.remove();
            backHandlerRef.current = undefined;
        }
        backHandlerRef.current = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                onDismiss?.();
                return true;
            },
        );

        const focusFirst = () => {
            if (firstFocusName && tvFocus.focusByName(firstFocusName)) {
                return;
            }
            tvFocus.focusFirstInActiveLayer();
        };
        const t1 = setTimeout(focusFirst, 350);
        const t2 = setTimeout(focusFirst, 900);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            sharedShowValue.value = 0;
            if (backHandlerRef.current) {
                backHandlerRef.current?.remove();
                backHandlerRef.current = undefined;
            }
        };
    }, []);

    const containerStyle = useAnimatedStyle(() => {
        return {
            opacity: withTiming(
                sharedShowValue.value,
                timingConfig.animationFast,
            ),
        };
    });

    const scaleAnimationStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    scale: withTiming(
                        0.9 + sharedShowValue.value * 0.1,
                        timingConfig.animationFast,
                    ),
                },
            ],
        };
    });

    return (
        <TvFocusLayer>
        <View style={styles.backContainer}>
            {/* 遮罩只负责"点空白关闭"，绝不能注册成焦点节点：
                否则弹框一出现焦点就落在整屏遮罩上，光环画在屏幕边缘，
                用户看到的是"弹框里没有光环、方向键也没反应"。 */}
            <RNPressable style={styles.container} onPress={onDismiss}>
                <Animated.View style={[styles.container, containerStyle]} />
            </RNPressable>
            <Animated.View
                style={[
                    styles.dialogContainer,
                    dialogContainerStyle,
                    containerStyle,
                    scaleAnimationStyle,
                    {
                        backgroundColor: colors.backdrop,
                        shadowColor: colors.shadow,
                    },
                ]}>
                {children}
            </Animated.View>
        </View>
        </TvFocusLayer>
    );
}

interface IDialogTitleProps {
    children?: ReactNode;
    withDivider?: boolean;
    stringContent?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
}

function Title(props: IDialogTitleProps) {
    const { children, withDivider, stringContent, containerStyle } = props;

    return (
        <>
            <View style={[styles.titleContainer, containerStyle]}>
                {typeof children === "string" || stringContent ? (
                    <ThemeText
                        fontSize="title"
                        fontWeight="bold"
                        numberOfLines={1}>
                        {children}
                    </ThemeText>
                ) : (
                    children
                )}
            </View>
            {withDivider ? <Divider /> : null}
        </>
    );
}

interface IDialogContentProps {
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
    needScroll?: boolean;
}

function Content(props: IDialogContentProps) {
    const { children, style, needScroll } = props;

    const content =
        typeof children === "string" ? (
            <ThemeText fontSize="content" style={styles.defaultFontStyle}>
                {children}
            </ThemeText>
        ) : (
            children
        );

    return (
        <View
            style={[
                styles.contentContainer,
                {
                    maxHeight: vh(50),
                },
                style,
            ]}>
            {needScroll ? <ScrollView>{content}</ScrollView> : content}
        </View>
    );
}

interface IDialogActionsProps {
    children?: ReactNode;
    actions?: Array<{
        title: string;
        type?: "normal" | "primary";
        show?: boolean;
        onPress?: () => void;
    }>;
    style?: StyleProp<ViewStyle>;
}

function Actions(props: IDialogActionsProps) {
    const { children, style, actions } = props;

    const validActions = useMemo(
        () => actions?.filter(it => it.show !== false),
        [actions],
    );

    const _children = validActions?.length ? (
        <>
            {validActions.map((it, index) =>
                it.show === false ? null : (
                    <BottomButton
                        key={index}
                        name={`dialog:action:${index}`}
                        focusOrder={index}
                        style={index === 0 ? null : styles.actionButton}
                        onPress={it.onPress}
                        text={it.title}
                        type={it.type}
                    />
                ),
            )}
        </>
    ) : (
        children
    );

    return (
        <View style={[styles.actionsContainer, style]}>
            {typeof children === "string" ? (
                <ThemeText fontSize="content" numberOfLines={1}>
                    {children}
                </ThemeText>
            ) : (
                _children
            )}
        </View>
    );
}

function BottomButton(props: {
    type?: "normal" | "primary";
    text: string;
    name?: string;
    focusOrder?: number;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
}) {
    const { type = "normal", text, style, onPress, name, focusOrder } = props;
    const colors = useColors();

    const primary = type === "primary";
    return (
        <TvFocusable
            name={name}
            focusOrder={focusOrder}
            onPress={onPress}
            style={[
                styles.bottomBtn,
                {
                    backgroundColor: primary
                        ? "rgba(169,233,255,0.14)"
                        : "rgba(255,255,255,0.08)",
                    borderColor: primary
                        ? colors.primary
                        : "rgba(255,255,255,0.24)",
                },
                style,
            ]}>
            <ThemeText
                color={primary ? colors.primary : undefined}
                fontWeight="bold">
                {text}
            </ThemeText>
        </TvFocusable>
    );
}

const styles = StyleSheet.create({
    bottomBtn: {
        borderRadius: rpx(12),
        minWidth: rpx(210),
        paddingHorizontal: rpx(30),
        flexShrink: 0,
        justifyContent: "center",
        alignItems: "center",
        height: rpx(64),
        borderWidth: rpx(2),
    },
    backContainer: {
        position: "absolute",
        zIndex: 16299,
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    container: {
        zIndex: 16300,
        position: "absolute",
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    dialogContainer: {
        position: "absolute",
        zIndex: 16310,
        borderRadius: rpx(20),
        borderWidth: rpx(1),
        borderColor: "rgba(169,233,255,0.20)",
        overflow: "hidden",
        paddingBottom: rpx(26),
        backgroundColor: "#101a2b",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.5,
        shadowRadius: 4,

        elevation: 5,
    },

    defaultFontStyle: {
        lineHeight: fontSizeConst.content * 1.5,
    },

    /**** title */
    titleContainer: {
        height: rpx(84),
        width: "100%",
        alignItems: "center",
        justifyContent: "flex-start",
        flexDirection: "row",
        paddingHorizontal: rpx(30),
    },
    /** content */
    contentContainer: {
        width: "100%",
        paddingHorizontal: rpx(30),
        paddingTop: rpx(8),
        paddingBottom: rpx(28),
    },
    /** actions */
    actionsContainer: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingHorizontal: rpx(28),
        paddingTop: rpx(12),
        gap: rpx(16),
        flexWrap: "nowrap",
    },
    actionButton: {
        marginLeft: rpx(24),
    },
});

Dialog.Title = Title;
Dialog.Content = Content;
Dialog.Actions = Actions;

export default Dialog;
