import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TvFocusable } from "@/tv/components";
import rpx from "@/utils/rpx";

interface IRoute {
    key: string;
    title?: string;
}

interface IProps {
    navigationState?: {
        index: number;
        routes: IRoute[];
    };
    jumpTo?: (key: string) => void;
    scrollEnabled?: boolean;
    [key: string]: any;
}

/**
 * TV 版 Tab 栏：替换 react-native-tab-view 的 TabBar。
 * 每个页签都是独立焦点节点，遥控左右键可以在页签间移动，OK 键切换。
 */
export default function TvTabBar(props: IProps) {
    const routes = props?.navigationState?.routes ?? [];
    const index = props?.navigationState?.index ?? 0;

    if (!routes.length) {
        return null;
    }

    return (
        <View style={styles.wrapper}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.content}>
                {routes.map((route, i) => {
                    const active = i === index;
                    return (
                        <TvFocusable
                            key={route.key}
                            name={`tvtab:${route.key}`}
                            focusOrder={i}
                            onPress={() => props.jumpTo?.(route.key)}
                            style={[
                                styles.tab,
                                active ? styles.tabActive : null,
                            ]}>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.label,
                                    active ? styles.labelActive : null,
                                ]}>
                                {route.title ?? route.key}
                            </Text>
                        </TvFocusable>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
    },
    content: {
        alignItems: "center",
        paddingHorizontal: rpx(12),
        paddingVertical: rpx(10),
    },
    tab: {
        minWidth: rpx(150),
        height: rpx(62),
        paddingHorizontal: rpx(24),
        marginRight: rpx(14),
        borderRadius: rpx(12),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    tabActive: {
        backgroundColor: "rgba(95,208,255,0.22)",
    },
    label: {
        fontSize: rpx(30),
        color: "#c9d6e2",
    },
    labelActive: {
        color: "#ffffff",
        fontWeight: "bold",
    },
});
