import React from "react";
import { StyleSheet, View } from "react-native";

/**
 * 自绘二维码图标。
 * 图标字体里没有二维码图形，这里用纯 View 拼一个：
 * 三个定位角（左上/右上/左下）+ 中间数据点阵，任意尺寸下都清晰。
 */
const PATTERN = [
    "0100110",
    "1011001",
    "0001110",
    "1100011",
    "0110100",
    "1011010",
    "0010111",
];

export default function QrGlyph(props: {
    size?: number;
    color?: string;
}) {
    const size = props.size ?? 32;
    const color = props.color ?? "#ffffff";
    const cell = size / 11;
    const corner = cell * 3.2;

    const renderCorner = (key: string, style: any) => (
        <View key={key} style={[styles.corner, { width: corner, height: corner, borderColor: color, borderWidth: cell * 0.55, borderRadius: cell * 0.3 }, style]} />
    );

    return (
        <View style={{ width: size, height: size }}>
            {renderCorner("tl", { left: 0, top: 0 })}
            {renderCorner("tr", { right: 0, top: 0 })}
            {renderCorner("bl", { left: 0, bottom: 0 })}
            <View
                style={{
                    position: "absolute",
                    left: cell * 4.6,
                    top: cell * 4,
                    width: cell * 7,
                    height: cell * 7,
                    flexDirection: "row",
                    flexWrap: "wrap",
                }}>
                {PATTERN.map((row, y) =>
                    row.split("").map((bit, x) =>
                        bit === "1" ? (
                            <View
                                key={`d-${y}-${x}`}
                                style={{
                                    width: cell,
                                    height: cell,
                                    backgroundColor: color,
                                }}
                            />
                        ) : (
                            <View
                                key={`d-${y}-${x}`}
                                style={{ width: cell, height: cell }}
                            />
                        ),
                    ),
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    corner: {
        position: "absolute",
        backgroundColor: "transparent",
    },
});
