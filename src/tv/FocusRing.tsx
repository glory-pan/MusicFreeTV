import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { tvFocus } from "./focusStore";
import { TvRect } from "./types";
import useColors from "@/hooks/useColors";

/**
 * 全局焦点环：电视上唯一的"我在哪里"的视觉反馈，
 * 用一次测量把环画在焦点元素外侧，避免每个组件各写一套高亮样式。
 */
export default function FocusRing() {
    const originRef = useRef<any>(null);
    const [origin, setOrigin] = useState<{ x: number; y: number }>({
        x: 0,
        y: 0,
    });
    const [rect, setRect] = useState<TvRect | null>(null);
    const colors = useColors();

    useEffect(() => {
        const update = () => {
            // 返回图标这类"窄高"节点量出来往往是个细长条，环套上去很难看：
            // 统一按量到的最大边长做成一个方环，居中贴住图标
            const name = tvFocus.getFocusedNode()?.debugName ?? "";
            const raw = tvFocus.getFocusedRect();
            if (raw && /back/i.test(name)) {
                const side = Math.min(
                    Math.max(raw.width, raw.height),
                    120,
                );
                setRect({
                    x: raw.x + (raw.width - side) / 2,
                    y: raw.y + (raw.height - side) / 2,
                    width: side,
                    height: side,
                });
                const node = originRef.current;
                if (node?.measureInWindow) {
                    node.measureInWindow((x: number, y: number) => {
                        setOrigin(prev =>
                            prev.x === x && prev.y === y ? prev : { x, y },
                        );
                    });
                }
                return;
            }
            setRect(raw);
            const node = originRef.current;
            if (node?.measureInWindow) {
                node.measureInWindow((x: number, y: number) => {
                    setOrigin(prev =>
                        prev.x === x && prev.y === y ? prev : { x, y },
                    );
                });
            }
        };
        update();
        const unsubscribe = tvFocus.subscribeRing(update);
        const timer = setInterval(update, 400);
        return () => {
            unsubscribe();
            clearInterval(timer);
        };
    }, []);

    const frame = rect
        ? {
              left: rect.x - origin.x - 4,
              top: rect.y - origin.y - 4,
              width: rect.width + 8,
              height: rect.height + 8,
          }
        : null;

    return (
        <View
            ref={originRef}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}>
            {frame ? (
                <>
                    <View
                        style={[
                            styles.ring,
                            frame,
                            {
                                borderColor: colors.primary,
                                backgroundColor: colorWithAlpha(
                                    colors.primary,
                                    0.08,
                                ),
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.glow,
                            frame,
                            { borderColor: colorWithAlpha(colors.primary, 0.22) },
                        ]}
                    />
                </>
            ) : null}
        </View>
    );
}

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

const styles = StyleSheet.create({
    ring: {
        position: "absolute",
        borderRadius: 12,
        borderWidth: 2.5,
    },
    glow: {
        position: "absolute",
        borderRadius: 16,
        borderWidth: 6,
    },
});
