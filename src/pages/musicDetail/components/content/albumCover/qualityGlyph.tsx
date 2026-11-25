import React from "react";
import { View } from "react-native";
import rpx from "@/utils/rpx";

/**
 * 电视端「音质」图形图标：三根递进竖条（低 → 高音质档位）+ 顶部一颗星点。
 * 与均衡器（纯竖条跳动）、MV（圆内播放三角）、播放列表（三横线）区分开。
 */
export default function QualityGlyph({
    color = "#ffffff",
    size = 40,
}: {
    color?: string;
    size?: number;
}) {
    const unit = size / 40;
    const barW = Math.max(3, Math.round(rpx(5) * unit));
    const gap = Math.max(2, Math.round(rpx(4) * unit));
    const heights = [0.5, 0.72, 0.94].map(
        h => Math.round(size * h),
    );

    return (
        <View
            style={{
                width: Math.round(size * 0.92),
                height: size,
                alignItems: "center",
                justifyContent: "flex-end",
            }}>
            <View
                style={{
                    position: "absolute",
                    top: 0,
                    right: Math.round(size * 0.04),
                    width: Math.max(3, Math.round(rpx(6) * unit)),
                    height: Math.max(3, Math.round(rpx(6) * unit)),
                    borderRadius: rpx(6),
                    backgroundColor: color,
                }}
            />
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    height: heights[2],
                }}>
                {heights.map((h, index) => (
                    <View
                        key={`qbar-${index}`}
                        style={{
                            width: barW,
                            height: h,
                            borderRadius: barW,
                            backgroundColor: color,
                            marginLeft: index === 0 ? 0 : gap,
                        }}
                    />
                ))}
            </View>
            <View
                style={{
                    marginTop: Math.round(rpx(4) * unit),
                    width: Math.round(size * 0.86),
                    height: Math.max(2, Math.round(rpx(3) * unit)),
                    borderRadius: rpx(3),
                    backgroundColor: color,
                }}
            />
        </View>
    );
}
