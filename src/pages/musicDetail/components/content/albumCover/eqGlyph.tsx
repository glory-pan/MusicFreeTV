import React from "react";
import { StyleSheet, View } from "react-native";

/**
 * 电视端「音效均衡器」图形图标（用户指定的竖条 + 横杠组合图形）。
 * 用 size 作为唯一尺度，任何按钮高度下都不会糊成一团。
 */
export default function EqGlyph({ color = "#ffffff", size = 40 }: any) {
    const bar = Math.max(2, size * 0.11);
    const long = size * 0.5;
    const short = size * 0.3;
    const wide = size * 0.32;
    const gap = size * 0.13;

    const vLine = (key: string, height: number) => (
        <View
            key={key}
            style={{
                width: bar,
                height,
                borderRadius: bar,
                backgroundColor: color,
            }}
        />
    );
    const hLine = (key: string, width: number, extra?: any) => (
        <View
            key={key}
            style={[
                {
                    width,
                    height: bar,
                    borderRadius: bar,
                    backgroundColor: color,
                },
                extra,
            ]}
        />
    );

    return (
        <View style={styles.wrap}>
            <View style={styles.row}>
                {vLine("a", long)}
                <View style={{ alignItems: "center", marginHorizontal: gap }}>
                    {vLine("b", short)}
                    {hLine("c", wide, { marginTop: gap })}
                </View>
                {vLine("d", long)}
            </View>
            <View style={[styles.row, { marginTop: gap }]}>
                <View style={{ alignItems: "center", marginRight: gap }}>
                    {hLine("e", wide)}
                    {vLine("f", short)}
                </View>
                {vLine("g", long)}
                <View style={{ alignItems: "center", marginLeft: gap }}>
                    {hLine("h", wide)}
                    {vLine("i", short)}
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
