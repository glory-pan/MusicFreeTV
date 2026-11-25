import React from "react";
import { View } from "react-native";

/**
 * 电视端「MV / 视频播放」图形图标：圆环 + 圆内播放三角（用户指定的形状）。
 */
export default function MotionPlayGlyph({
    color = "#ffffff",
    size = 40,
}: any) {
    const ringW = Math.max(2, size * 0.1);
    const triH = size * 0.36;
    const triW = size * 0.32;

    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: ringW,
                borderColor: color,
                alignItems: "center",
                justifyContent: "center",
            }}>
            <View
                style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: triW,
                    borderTopWidth: triH / 2,
                    borderBottomWidth: triH / 2,
                    borderLeftColor: color,
                    borderTopColor: "transparent",
                    borderBottomColor: "transparent",
                    marginLeft: size * 0.06,
                }}
            />
        </View>
    );
}
