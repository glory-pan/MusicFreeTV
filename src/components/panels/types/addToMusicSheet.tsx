import React from "react";
import { StyleSheet } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import Toast from "@/utils/toast";
import TvCardPanel from "../base/tvCardPanel";
import { hidePanel, showPanel } from "../usePanel";
import MusicSheet, { useSheetsBase } from "@/core/musicSheet";
import { TvFocusable } from "@/tv/components";
import { TvScrollView } from "@/tv/scroll";

interface IAddToMusicSheetProps {
    musicItem: IMusic.IMusicItem | IMusic.IMusicItem[];
    newSheetDefaultName?: string;
    /** 关闭卡片后把光环还给打开它的那个图标 */
    returnFocusName?: string;
}

export default function AddToMusicSheet(props: IAddToMusicSheetProps) {
    const sheets = useSheetsBase();
    const { musicItem = [], returnFocusName = "tvplayer:toggle" } =
        props ?? {};
    const count = Array.isArray(musicItem) ? musicItem.length : 1;

    return (
        <TvCardPanel title={`添加到歌单（${count} 首）`} firstFocusName="addsheet:new"
            returnFocusName={returnFocusName}>
            <TvScrollView style={styles.list}>
                <TvFocusable
                    name="addsheet:new"
                    focusOrder={0}
                    style={[styles.row, styles.rowNew]}
                    onPress={() => {
                        showPanel("SimpleInput", {
                            title: "新建歌单",
                            placeholder: "输入歌单名称",
                            hints: [],
                            async onOk(text: string) {
                                const name = (text ?? "").trim();
                                if (!name) {
                                    return;
                                }
                                try {
                                    const sheetId = await MusicSheet.addSheet(name);
                                    await MusicSheet.addMusic(sheetId, musicItem);
                                    Toast.success("已创建歌单并添加歌曲");
                                    hidePanel();
                                } catch {
                                    Toast.warn("添加失败");
                                }
                            },
                        });
                    }}>
                    <Icon accessible={false} name="plus" size={rpx(40)} color="#5fd0ff" />
                    <ThemeText fontSize="subTitle" style={styles.text}>
                        新建歌单
                    </ThemeText>
                </TvFocusable>
                {(sheets ?? []).map((sheet, index) => (
                    <TvFocusable
                        key={`sheet-${sheet.id}`}
                        name={`addsheet:${index}`}
                        focusOrder={index + 1}
                        style={styles.row}
                        onPress={async () => {
                            try {
                                await MusicSheet.addMusic(sheet.id, musicItem);
                                Toast.success(`已添加到「${sheet.title}」`);
                                hidePanel();
                            } catch {
                                Toast.warn("添加失败");
                            }
                        }}>
                        <Icon
                            accessible={false}
                            name="musical-note"
                            size={rpx(34)}
                            color="#ffffff"
                        />
                        <ThemeText fontSize="subTitle" numberOfLines={1} style={styles.text}>
                            {sheet.title ?? "未命名歌单"}
                        </ThemeText>
                    </TvFocusable>
                ))}
            </TvScrollView>
        </TvCardPanel>
    );
}

const styles = StyleSheet.create({
    list: {
        width: "100%",
        maxHeight: rpx(330),
    },
    row: {
        width: "100%",
        height: rpx(80),
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(18),
        marginVertical: rpx(4),
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.06)",
    },
    rowNew: {
        backgroundColor: "rgba(95,208,255,0.14)",
    },
    text: {
        marginLeft: rpx(16),
        flexShrink: 1,
    },
});
