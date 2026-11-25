import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "./qr";
import { IQrServerInfo, TPendingPlugin, tvQrServer } from "./bridge";
import { TvFocusLayer, TvFocusable } from "./components";
import { useTvKeys } from "./provider";

export type TQrMode = "text" | "plugin";

export interface IQrShowOptions {
    mode: TQrMode;
    /** text 模式下区分"歌名搜索"和"链接输入"页面 */
    kind?: "text" | "link";
    title?: string;
    onText?: (text: string) => void;
    onPlugin?: (plugin: TPendingPlugin) => void;
}

let currentOptions: IQrShowOptions | null = null;
const listeners = new Set<() => void>();

/** 打开扫码弹层（全局唯一宿主，挂在 entry 里） */
export function showQrInput(options: IQrShowOptions) {
    currentOptions = options;
    listeners.forEach(listener => listener());
}

/**
 * 电视端扫码弹层：显示二维码 → 手机扫码 → 文字/插件通过局域网回传。
 */
export function TvQrOverlay() {
    const [options, setOptions] = useState<IQrShowOptions | null>(null);
    const [info, setInfo] = useState<IQrServerInfo | null>(null);
    const [status, setStatus] = useState("");
    const optionsRef = useRef<IQrShowOptions | null>(null);

    useEffect(() => {
        const listener = () => {
            setOptions(currentOptions);
            setStatus("");
        };
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    useEffect(() => {
        optionsRef.current = options;
        if (!options) {
            return;
        }
        let disposed = false;
        let timer: ReturnType<typeof setInterval> | null = null;

        tvQrServer.start().then(result => {
            if (disposed) {
                return;
            }
            if (!result) {
                setStatus("扫码服务不可用");
                return;
            }
            setInfo(result);
            timer = setInterval(async () => {
                const mode = optionsRef.current?.mode;
                if (mode === "text") {
                    const text = await tvQrServer.pollText();
                    if (text && optionsRef.current) {
                        optionsRef.current.onText?.(text);
                        setOptions(null);
                    }
                } else if (mode === "plugin") {
                    const plugin = await tvQrServer.pollPlugin();
                    if (plugin && optionsRef.current) {
                        optionsRef.current.onPlugin?.(plugin);
                        setOptions(null);
                    }
                }
            }, 900);
        });

        return () => {
            disposed = true;
            if (timer) {
                clearInterval(timer);
            }
        };
    }, [options]);

    // 弹层还在时接管 OK 与返回：不管光环落在哪，都能一键关掉
    useTvKeys((key, action) => {
        if (!optionsRef.current) {
            return false;
        }
        if (key === "center" || key === "menu" || key === "stop") {
            setOptions(null);
            return true;
        }
        return false;
    });

    if (!options) {
        return null;
    }

    const url =
        options.mode === "text"
            ? options.kind === "link"
                ? info?.linkUrl ?? info?.textUrl ?? ""
                : info?.textUrl ?? ""
            : info?.pluginUrl ?? "";

    return (
        <View style={styles.mask}>
                <TvFocusLayer>
                <View style={styles.card}>
                    <Text style={styles.title}>
                        {options.title ??
                            (options.mode === "text"
                                ? "手机扫码输入文字"
                                : "手机扫码导入插件")}
                    </Text>
                    {url ? (
                        <QRCode value={url} size={240} />
                    ) : (
                        <View style={styles.qrPlaceholder}>
                            <Text style={styles.placeholderText}>
                                {status || "正在启动扫码服务…"}
                            </Text>
                        </View>
                    )}
                    {url ? <Text style={styles.url}>{url}</Text> : null}
                    <Text style={styles.hint}>
                        {options.mode === "text"
                            ? "手机与电视连同一 Wi-Fi，扫码后在手机上输入歌名或歌手，发送后电视会自动搜索。"
                            : "扫码后在手机上选择本地 .js 音源插件上传，或填写插件链接，电视会自动安装。"}
                    </Text>
                    <TvFocusable
                        style={styles.close}
                        onPress={() => setOptions(null)}>
                        <Text style={styles.closeText}>关闭</Text>
                    </TvFocusable>
                </View>
                </TvFocusLayer>
        </View>
    );
}

const styles = StyleSheet.create({
    mask: {
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.72)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        elevation: 30,
    },
    card: {
        width: 460,
        backgroundColor: "#151b24",
        borderRadius: 20,
        padding: 24,
        alignItems: "center",
    },
    title: {
        color: "#eef3fa",
        fontSize: 22,
        fontWeight: "600",
        marginBottom: 18,
    },
    qrPlaceholder: {
        width: 240,
        height: 240,
        borderRadius: 12,
        backgroundColor: "#1d2634",
        alignItems: "center",
        justifyContent: "center",
    },
    placeholderText: {
        color: "#93a1b5",
        fontSize: 16,
    },
    url: {
        color: "#7f8da3",
        fontSize: 13,
        marginTop: 14,
    },
    hint: {
        color: "#9fb0c6",
        fontSize: 14,
        lineHeight: 22,
        marginTop: 14,
        textAlign: "center",
    },
    close: {
        marginTop: 20,
        paddingHorizontal: 42,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: "#2b3647",
    },
    closeText: {
        color: "#fff",
        fontSize: 18,
    },
});
