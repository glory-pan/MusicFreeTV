import React, { useEffect, useRef, useState } from "react";
import ThemeText from "@/components/base/themeText";
import { StyleSheet, View } from "react-native";
import rpx, { vh } from "@/utils/rpx";
import openUrl from "@/utils/openUrl";
import Clipboard from "@react-native-clipboard/clipboard";
import { TvTouchableOpacity as TouchableOpacity } from "@/tv/components";
import { TvScrollView as ScrollView } from "@/tv/scroll";
import { hideDialog } from "../useDialog";
import Checkbox from "@/components/base/checkbox";
import Button from "@/components/base/textButton.tsx";
import Dialog from "./base";
import PersistStatus from "@/utils/persistStatus";
import { useI18N } from "@/core/i18n";
import {
    canInstallApk,
    downloadApk,
    getDownloadProgress,
    installApk,
    openInstallPermission,
    updaterAvailable,
} from "@/tv/updater";

interface IDownloadDialogProps {
    version: string;
    content: string[];
    fromUrl: string;
    backUrl?: string;
    /** 更新包直链与文件名：有值就能在软件内直接下载安装 */
    apkUrl?: string;
    apkName?: string;
}
export default function DownloadDialog(props: IDownloadDialogProps) {
    const { content, fromUrl, backUrl, version, apkUrl, apkName } = props;
    const [skipState, setSkipState] = useState(false);
    // 本机下载进度：null = 还没开始
    const [inApp, setInApp] = useState<{
        percent: number;
        label: string;
        failed?: boolean;
    } | null>(null);
    const pollingRef = useRef<any>(null);

    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, []);

    const startInAppDownload = async () => {
        if (!apkUrl) {
            return;
        }
        PersistStatus.set("app.skipVersion", undefined);
        setInApp({ percent: 0, label: "正在连接更新服务器…" });
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
        }
        pollingRef.current = setInterval(async () => {
            try {
                const st = await getDownloadProgress();
                if (!st) {
                    return;
                }
                const total = st.total > 0 ? st.total : 0;
                const percent = total
                    ? Math.min(100, Math.round((st.received / total) * 100))
                    : 0;
                const mb = (st.received / 1048576).toFixed(1);
                setInApp({
                    percent,
                    label: st.done
                        ? "下载完成，正在调起安装…"
                        : `正在下载 ${percent}%（${mb} MB）`,
                });
            } catch {}
        }, 500);
        try {
            const path = await downloadApk(apkUrl, apkName || "MusicFreeTV.apk");
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
            const allowed = await canInstallApk();
            if (!allowed) {
                setInApp({
                    percent: 100,
                    label: "已下载完成。请在系统里允许本应用「安装未知应用」，再点一次这个按钮即可安装",
                });
                await openInstallPermission();
                return;
            }
            await installApk(path);
            setInApp({
                percent: 100,
                label: "已调起系统安装器，按电视上的提示点「安装」就行",
            });
        } catch (e: any) {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
            setInApp({
                percent: 0,
                label: `下载失败：${e?.message ?? "网络异常"}，可以试试用浏览器方式下载`,
                failed: true,
            });
        }
    };

    const { t } = useI18N();

    return (
        <Dialog
            onDismiss={() => {
                if (skipState) {
                    PersistStatus.set("app.skipVersion", version);
                }
                hideDialog();
            }}>
            <Dialog.Title stringContent>{t("dialog.downloadDialog.title", {
                version: version,
            })}</Dialog.Title>
            <ScrollView style={style.scrollView}>
                {content?.map?.(_ => (
                    <ThemeText key={_} style={style.item}>
                        {_}
                    </ThemeText>
                ))}
            </ScrollView>
            {inApp ? (
                <ThemeText
                    style={[
                        style.progressText,
                        inApp.failed ? { opacity: 0.85 } : null,
                    ]}>
                    {inApp.label}
                </ThemeText>
            ) : null}
            <Dialog.Actions style={style.dialogActions}>
                <TouchableOpacity
                    onPress={() => {
                        setSkipState(state => !state);
                    }}>
                    <View style={style.checkboxGroup}>
                        <Checkbox checked={skipState} />
                        <ThemeText style={style.checkboxHint}>
                            {t("dialog.downloadDialog.skipThisVersion")}
                        </ThemeText>
                    </View>
                </TouchableOpacity>
                <View style={style.buttonGroup}>
                    <Button
                        style={style.button}
                        onPress={() => {
                            hideDialog();
                            if (skipState) {
                                PersistStatus.set("app.skipVersion", version);
                            }
                        }}>
                        {t("common.cancel")}
                    </Button>
                    {updaterAvailable && apkUrl ? (
                        <Button
                            fontColor="primary"
                            style={style.button}
                            onPress={startInAppDownload}>
                            直接下载并安装
                        </Button>
                    ) : null}
                    <Button
                        style={style.button}
                        onPress={async () => {
                            PersistStatus.set("app.skipVersion", undefined);
                            openUrl(fromUrl);
                            Clipboard.setString(fromUrl);
                        }}>
                        {t("dialog.downloadDialog.downloadUsingBrowser")}
                    </Button>
                    {backUrl && (
                        <Button
                            style={style.button}
                            onPress={async () => {
                                PersistStatus.set("app.skipVersion", undefined);
                                openUrl(backUrl);
                                Clipboard.setString(backUrl);
                            }}>
                            {t("dialog.downloadDialog.backupUrl")}
                        </Button>
                    )}
                </View>
            </Dialog.Actions>
        </Dialog>
    );
}

const style = StyleSheet.create({
    item: {
        marginBottom: rpx(20),
        lineHeight: rpx(36),
    },
    content: {
        flex: 1,
        maxHeight: vh(50),
    },
    scrollView: {
        maxHeight: vh(40),
        paddingHorizontal: rpx(26),
    },
    dialogActions: {
        marginTop: rpx(24),
        height: rpx(120),
        marginBottom: rpx(12),
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
    },
    checkboxGroup: {
        flexDirection: "row",
        alignItems: "center",
    },
    buttonGroup: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        justifyContent: "flex-end",
    },
    progressText: {
        paddingHorizontal: rpx(26),
        marginTop: rpx(10),
        lineHeight: rpx(34),
    },
    checkboxHint: {
        marginLeft: rpx(12),
    },
    button: {
        paddingLeft: rpx(28),
        paddingVertical: rpx(14),
        marginLeft: rpx(16),
        alignItems: "flex-end",
    },
});
