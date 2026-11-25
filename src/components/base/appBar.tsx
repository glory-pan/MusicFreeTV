import React, { ReactNode, useEffect, useState } from "react";
import { LayoutRectangle, StatusBar as OriginalStatusBar, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { TvTouchableWithoutFeedback as TouchableWithoutFeedback } from "@/tv/components";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import StatusBar from "./statusBar";
import color from "color";
import IconButton from "./iconButton";
import Icon from "./icon";
import globalStyle from "@/constants/globalStyle";
import ThemeText from "./themeText";
import { useNavigation } from "@react-navigation/native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import Portal from "./portal";
import ListItem from "./listItem";
import { IIconName } from "@/components/base/icon.tsx";
import { isTvBuild } from "@/tv/keyEvent";
import { TvFocusable } from "@/tv/components";

interface IAppBarProps {
    titleTextOpacity?: number;
    withStatusBar?: boolean;
    color?: string;
    actions?: Array<{
        icon: IIconName;
        /** 电视端按钮上的文字（不填则只显示图标） */
        title?: string;
        onPress?: () => void;
    }>;
    menu?: Array<{
        icon: IIconName;
        title: string;
        show?: boolean;
        onPress?: () => void;
    }>;
    menuWithStatusBar?: boolean;
    children?: string | ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    actionComponent?: ReactNode;
    onBackPress?: () => void;
}

const ANIMATION_EASING: Animated.EasingFunction = Easing.out(Easing.exp);
const ANIMATION_DURATION = 500;

const timingConfig = {
    duration: ANIMATION_DURATION,
    easing: ANIMATION_EASING,
};

export default function AppBar(props: IAppBarProps) {
    const {
        titleTextOpacity = 1,
        withStatusBar,
        color: _color,
        actions = [],
        menu = [],
        menuWithStatusBar = true,
        containerStyle,
        contentStyle,
        children,
        actionComponent,
        onBackPress,
    } = props;

    const colors = useColors();
    const navigation = useNavigation();

    const bgColor = color(colors.appBar ?? colors.primary).toString();
    const contentColor = _color ?? colors.appBarText;

    const tvMenuItems = (menu ?? []).filter(it => it.show !== false);
    const [showMenu, setShowMenu] = useState(false);
    const [menuIconLayout, setMenuIconLayout] =
        useState<LayoutRectangle | null>(null);
    const scaleRate = useSharedValue(0);

    useEffect(() => {
        if (showMenu) {
            scaleRate.value = withTiming(1, timingConfig);
        } else {
            scaleRate.value = withTiming(0, timingConfig);
        }
    }, [showMenu]);

    const transformStyle = useAnimatedStyle(() => {
        return {
            opacity: scaleRate.value,
        };
    });

    return (
        <>
            {withStatusBar ? <StatusBar backgroundColor={bgColor} /> : null}
            <View
                style={[
                    styles.container,
                    isTvBuild && styles.containerTv,
                    containerStyle,
                    { backgroundColor: bgColor },
                ]}>
                {isTvBuild ? (
                    // 电视上返回箭头只做视觉提示，不注册焦点节点：
                    // 遥控器有系统返回键，让箭头可聚焦只会在角落制造"死胡同"（实机卡死就是它）
                    <View
                        style={[globalStyle.notShrink, styles.tvBack]}
                        onTouchEnd={() => {
                            (onBackPress ||
                                (() => {
                                    navigation.goBack();
                                }))();
                        }}>
                        <Icon
                            accessible={false}
                            name="arrow-left"
                            size={rpx(40)}
                            color={contentColor}
                        />
                    </View>
                ) : (
                    <IconButton
                        name="arrow-left"
                        focusName="appbar:back"
                        focusOrder={900}
                        sizeType="normal"
                        color={contentColor}
                        style={globalStyle.notShrink}
                        onPress={
                            onBackPress ||
                            (() => {
                                navigation.goBack();
                            })
                        }
                    />
                )}
                <View style={[globalStyle.grow, styles.content, contentStyle]}>
                    {typeof children === "string" ? (
                        <ThemeText
                            fontSize="title"
                            fontWeight="bold"
                            numberOfLines={1}
                            color={
                                titleTextOpacity !== 1
                                    ? color(contentColor)
                                        .alpha(titleTextOpacity)
                                        .toString()
                                    : contentColor
                            }>
                            {children}
                        </ThemeText>
                    ) : (
                        children
                    )}
                </View>
                {isTvBuild ? (
                    <View style={[styles.tvRight, globalStyle.notShrink]}>
                        {actions.map((action, index) =>
                            action ? (
                                <TvFocusable
                                    key={`act-${index}`}
                                    name={`appbar:act:${index}`}
                                    focusOrder={800 + index}
                                    leftName={
                                        index === 0
                                            ? undefined
                                            : `appbar:act:${index - 1}`
                                    }
                                    rightName={
                                        index === actions.length - 1
                                            ? tvMenuItems.length
                                                ? "appbar:menu"
                                                : undefined
                                            : `appbar:act:${index + 1}`
                                    }
                                    onPress={action.onPress}
                                    style={styles.tvPill}>
                                    <Icon
                                        accessible={false}
                                        name={action.icon}
                                        size={rpx(32)}
                                        color={colors.appBarText}
                                    />
                                    {action.title ? (
                                        <ThemeText
                                            fontSize="content"
                                            fontColor="text"
                                            style={styles.tvPillText}>
                                            {action.title}
                                        </ThemeText>
                                    ) : null}
                                </TvFocusable>
                            ) : null,
                        )}
                        {actionComponent ?? null}
                        {tvMenuItems.length === 1 ? (
                            <TvFocusable
                                name="appbar:menu"
                                focusOrder={820}
                                leftName={
                                    actions.length
                                        ? `appbar:act:${actions.length - 1}`
                                        : undefined
                                }
                                onPress={tvMenuItems[0].onPress}
                                style={styles.tvPill}>
                                <Icon
                                    accessible={false}
                                    name={tvMenuItems[0].icon}
                                    size={rpx(32)}
                                    color={colors.appBarText}
                                />
                                <ThemeText
                                    fontSize="content"
                                    style={styles.tvPillText}>
                                    {tvMenuItems[0].title}
                                </ThemeText>
                            </TvFocusable>
                        ) : tvMenuItems.length > 1 ? (
                            <TvFocusable
                                name="appbar:menu"
                                focusOrder={820}
                                leftName={
                                    actions.length
                                        ? `appbar:act:${actions.length - 1}`
                                        : undefined
                                }
                                onPress={() => {
                                    // 延迟 require：panels 会反过来引用 AppBar，
                                    // 顶层 import 会形成循环依赖（真机上表现为整屏崩溃）
                                    const panelsModule = require("@/components/panels/usePanel");
                                    panelsModule.showPanel("TvActionMenu", {
                                        title: "更多",
                                        items: tvMenuItems.map(it => ({
                                            icon: it.icon,
                                            title: it.title,
                                            onPress: it.onPress,
                                            show: it.show,
                                        })),
                                        returnFocusName: "appbar:menu",
                                    });
                                }}
                                style={styles.tvPill}>
                                <Icon
                                    accessible={false}
                                    name="ellipsis-vertical"
                                    size={rpx(32)}
                                    color={colors.appBarText}
                                />
                                <ThemeText
                                    fontSize="content"
                                    style={styles.tvPillText}>
                                    更多
                                    </ThemeText>
                            </TvFocusable>
                        ) : null}
                    </View>
                ) : (
                    <>
                        {actions.map((action, index) => (
                            <IconButton
                                key={index}
                                name={action.icon}
                                sizeType="normal"
                                color={contentColor}
                                style={[globalStyle.notShrink, styles.rightButton]}
                                onPress={action.onPress}
                            />
                        ))}
                        {actionComponent ?? null}
                    </>
                )}
                {!isTvBuild && menu?.length ? (
                    <IconButton
                        name="ellipsis-vertical"
                        sizeType="normal"
                        onLayout={evt => {
                            setMenuIconLayout(evt.nativeEvent.layout);
                        }}
                        color={contentColor}
                        style={[globalStyle.notShrink, styles.rightButton]}
                        onPress={() => {
                            setShowMenu(true);
                        }}
                    />
                ) : null}
            </View>
            <Portal>
                {showMenu ? (
                    <TouchableWithoutFeedback
                        onPress={() => {
                            setShowMenu(false);
                        }}>
                        <View style={styles.blocker} />
                    </TouchableWithoutFeedback>
                ) : null}
                <>
                    <Animated.View
                        pointerEvents={showMenu ? "auto" : "none"}
                        style={[
                            {
                                borderBottomColor: colors.background,
                                left:
                                    (menuIconLayout?.x ?? 0) +
                                    (menuIconLayout?.width ?? 0) / 2 -
                                    rpx(10),
                                top:
                                    (menuIconLayout?.y ?? 0) +
                                    (menuIconLayout?.height ?? 0) +
                                    (menuWithStatusBar
                                        ? OriginalStatusBar.currentHeight ?? 0
                                        : 0),
                            },
                            transformStyle,
                            styles.bubbleCorner,
                        ]}
                    />
                    <Animated.View
                        pointerEvents={showMenu ? "auto" : "none"}
                        style={[
                            {
                                backgroundColor: colors.background,
                                right: rpx(24),
                                top:
                                    (menuIconLayout?.y ?? 0) +
                                    (menuIconLayout?.height ?? 0) +
                                    rpx(20) +
                                    (menuWithStatusBar
                                        ? OriginalStatusBar.currentHeight ?? 0
                                        : 0),
                                shadowColor: colors.shadow,
                            },
                            transformStyle,
                            styles.menu,
                        ]}>
                        {menu.map(it =>
                            it.show !== false ? (
                                <ListItem
                                    key={it.title}
                                    withHorizontalPadding
                                    heightType="small"
                                    onPress={() => {
                                        setShowMenu(false);
                                        // async
                                        setTimeout(() => {
                                            it.onPress?.();
                                        }, 20);
                                    }}>
                                    <ListItem.ListItemIcon icon={it.icon} />
                                    <ListItem.Content title={it.title} />
                                </ListItem>
                            ) : null,
                        )}
                    </Animated.View>
                </>
            </Portal>
        </>
    );
}

const styles = StyleSheet.create({
    containerTv: {
        // 页头只包住搜索行本身（搜索栏 78rpx）；再薄 12px ≈ 9rpx
        height: rpx(70),
    },
    container: {
        width: "100%",
        zIndex: 10000,
        height: rpx(88),
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(24),
    },
    content: {
        flexDirection: "row",
        flexBasis: 0,
        alignItems: "center",
        paddingHorizontal: rpx(24),
    },
    rightButton: {
        marginLeft: rpx(28),
    },
    tvBack: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(10),
        alignItems: "center",
        justifyContent: "center",
    },
    tvRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: rpx(14),
    },
    tvPill: {
        height: rpx(64),
        minWidth: rpx(64),
        paddingHorizontal: rpx(20),
        borderRadius: rpx(12),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: rpx(10),
        backgroundColor: "rgba(255,255,255,0.10)",
        borderWidth: rpx(1),
        borderColor: "rgba(150,200,255,0.22)",
    },
    tvPillText: {
        fontSize: rpx(26),
    },
    blocker: {
        position: "absolute",
        bottom: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 10010,
    },
    bubbleCorner: {
        position: "absolute",
        borderColor: "transparent",
        borderWidth: rpx(10),
        zIndex: 10012,
        transformOrigin: "right top",
        opacity: 0,
    },
    menu: {
        width: rpx(340),
        maxHeight: rpx(600),
        borderRadius: rpx(8),
        zIndex: 10011,
        position: "absolute",
        opacity: 0,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
});
