import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
// @ts-ignore
import qrcode from "qrcode-generator";

interface IQRCodeProps {
    value: string;
    size?: number;
}

/**
 * 纯 View 渲染的二维码（不依赖 svg / 原生库），供电视端扫码用。
 */
export default function QRCode(props: IQRCodeProps) {
    const { value, size = 220 } = props;

    const matrix = useMemo(() => {
        try {
            const qr = qrcode(0, "M");
            qr.addData(value || "");
            qr.make();
            const count = qr.getModuleCount();
            const rows: boolean[][] = [];
            for (let row = 0; row < count; row++) {
                const line: boolean[] = [];
                for (let col = 0; col < count; col++) {
                    line.push(qr.isDark(row, col));
                }
                rows.push(line);
            }
            return { count, rows };
        } catch {
            return { count: 0, rows: [] as boolean[][] };
        }
    }, [value]);

    if (!matrix.count) {
        return <View style={[styles.box, { width: size, height: size }]} />;
    }

    const cell = Math.floor((size - 16) / matrix.count);
    const inner = cell * matrix.count;

    return (
        <View style={[styles.box, { width: size, height: size }]}>
            <View style={{ width: inner, height: inner }}>
                {matrix.rows.map((row, rowIndex) => (
                    <View
                        key={`r${rowIndex}`}
                        style={{ flexDirection: "row", height: cell }}>
                        {row.map((dark, colIndex) => (
                            <View
                                key={`c${colIndex}`}
                                style={{
                                    width: cell,
                                    height: cell,
                                    backgroundColor: dark
                                        ? "#0b0f14"
                                        : "#ffffff",
                                }}
                            />
                        ))}
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    box: {
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        padding: 8,
    },
});
