import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";

/**
 * 电视端「MV」图形图标（按用户提供的图形重绘）：
 * 上排三根竖线 + 中间一根横杠，下排两个 T 形 + 一根竖线。
 */
export default function MvGlyph({ color = "#ffffff", size = 46 }: any) {
    const scale = size / 46;
    const bar = Math.max(2, Math.round(rpx(4) * scale));
    const long = Math.round(rpx(22) * scale);
    const short = Math.round(rpx(14) * scale);
    const gap = Math.round(rpx(6) * scale);

    return (
        <View style={styles.wrap}>
            <View style={styles.row}>
                <View
                    style={{
                        width: bar,
                        height: long,
                        backgroundColor: color,
                        borderRadius: bar,
                    }}
                />
                <View style={{ alignItems: "center", marginHorizontal: gap }}>
                    <View
                        style={{
                            width: bar,
                            height: short,
                            backgroundColor: color,
                            borderRadius: bar,
                        }}
                    />
                    <View
                        style={{
                            width: Math.round(rpx(14) * scale),
                            height: bar,
                            backgroundColor: color,
                            borderRadius: bar,
                            marginTop: gap,
                        }}
                    />
                </View>
                <View
                    style={{
                        width: bar,
                        height: long,
                        backgroundColor: color,
                        borderRadius: bar,
                    }}
                />
            </View>
            <View style={[styles.row, { marginTop: gap }]}>
                <View style={{ alignItems: "center", marginRight: gap }}>
                    <View
                        style={{
                            width: Math.round(rpx(14) * scale),
                            height: bar,
                            backgroundColor: color,
                            borderRadius: bar,
                        }}
                    />
                    <View
                        style={{
                            width: bar,
                            height: short,
                            backgroundColor: color,
                            borderRadius: bar,
                            marginTop: gap,
                        }}
                    />
                </View>
                <View
                    style={{
                        width: bar,
                        height: long,
                        backgroundColor: color,
                        borderRadius: bar,
                        marginRight: gap,
                    }}
                />
                <View style={{ alignItems: "center" }}>
                    <View
                        style={{
                            width: Math.round(rpx(14) * scale),
                            height: bar,
                            backgroundColor: color,
                            borderRadius: bar,
                        }}
                    />
                    <View
                        style={{
                            width: bar,
                            height: short,
                            backgroundColor: color,
                            borderRadius: bar,
                            marginTop: gap,
                        }}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: "center",
        justifyContent: "center",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
});
