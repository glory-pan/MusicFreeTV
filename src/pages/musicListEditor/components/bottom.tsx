import Icon, { IIconName } from "@/components/base/icon.tsx";
import ThemeText from "@/components/base/themeText";
import { showPanel } from "@/components/panels/usePanel";
import { iconSizeConst } from "@/constants/uiConst";
import downloader from "@/core/downloader";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import { produce } from "immer";
import { useAtom, useSetAtom } from "jotai";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { TvPressable as Pressable } from "@/tv/components";
import { useSheetsBase } from "@/core/musicSheet";
import musicHistory from "@/core/musicHistory";
import { musicHistorySheetId } from "@/constants/commonConst";
import { editingMusicListAtom, musicListChangedAtom } from "../store/atom";

export default function Bottom() {
    const { musicSheet } = useParams<"music-list-editor">();
    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);
    const { t } = useI18N();
    const sheets = useSheetsBase();

    const selectedEditorItems = useMemo(
        () => editingMusicList.filter(_ => _.checked),
        [editingMusicList],
    );

    const selectedItems = useMemo(
        () => selectedEditorItems.map(_ => _.musicItem),
        [selectedEditorItems],
    );

    // 只有“本机自建/自存的歌单”才谈得上删歌：推荐歌单、榜单、插件歌单都是别人的，
    // 本地没有这份数据，删了也存不回去 —— 干脆不显示删除
    const isLocalSheet = useMemo(
        () =>
            !!musicSheet?.id &&
            sheets.some(_ => _.id === (musicSheet as any).id),
        [musicSheet?.id, sheets],
    );

    // 播放记录也是一份"本机自己存着的列表"，同样可以单条删除
    const isHistorySheet = musicSheet?.id === musicHistorySheetId;
    const canDelete = isLocalSheet || isHistorySheet;

    const nothingSelected = selectedItems.length === 0;

    function resetSelectedIndices() {
        setEditingMusicList(
            editingMusicList.map(_ => ({
                musicItem: _.musicItem,
                checked: false,
            })),
        );
    }

    return (
        <View style={style.wrapper}>
            <BottomIcon
                icon="motion-play"
                title={t("musicListEditor.addToNextPlay")}
                disabled={nothingSelected}
                onPress={async () => {
                    if (!selectedItems.length) {
                        return;
                    }
                    TrackPlayer.addNext(selectedItems);
                    resetSelectedIndices();
                    Toast.success(t("toast.addToNextPlay"));
                }}
            />
            <BottomIcon
                icon="folder-plus"
                title={t("musicListEditor.addToSheet")}
                disabled={nothingSelected}
                onPress={() => {
                    if (selectedItems.length) {
                        showPanel("AddToMusicSheet", {
                            musicItem: selectedItems,
                        });
                        resetSelectedIndices();
                    }
                }}
            />
            <BottomIcon
                icon="arrow-down-tray"
                title={t("common.download")}
                disabled={nothingSelected}
                onPress={() => {
                    if (selectedItems.length) {
                        downloader.download(selectedItems);
                        Toast.success(t("toast.beginDownload"));
                        resetSelectedIndices();
                    }
                }}
            />
            {canDelete ? (
                <BottomIcon
                    icon="trash-outline"
                    title={t("common.delete")}
                    disabled={nothingSelected}
                    onPress={() => {
                        if (!selectedItems.length) {
                            return;
                        }
                        const remain = editingMusicList
                            .filter(_ => !_.checked)
                            .map(_ => _.musicItem);
                        setEditingMusicList(
                            produce(prev => prev.filter(_ => !_.checked)),
                        );
                        if (isHistorySheet) {
                            // 播放记录没有"保存"这一步，删完直接落盘
                            musicHistory.setHistory(remain);
                            setMusicListChanged(false);
                            Toast.success(
                                `已删除 ${selectedItems.length} 条播放记录`,
                            );
                        } else {
                            setMusicListChanged(true);
                            Toast.warn(t("toast.rememberToSave"));
                        }
                    }}
                />
            ) : null}
        </View>
    );
}

interface IBottomIconProps {
    icon: IIconName;
    title: string;
    disabled?: boolean;
    onPress: () => void;
}
function BottomIcon(props: IBottomIconProps) {
    const { icon, title, onPress, disabled = false } = props;
    const colors = useColors();
    return (
        <Pressable
            onPress={onPress}
            style={[
                style.bottomIconWrapper,
                { backgroundColor: colors.appBar },
            ]}>
            <View style={[style.bottomIconInner, disabled ? style.dim : null]}>
                <Icon
                    name={icon}
                    color={colors.appBarText}
                    size={iconSizeConst.big}
                    onPress={onPress}
                />
                <ThemeText
                    fontSize="subTitle"
                    fontColor={"appBarText"}
                    style={style.bottomIconText}>
                    {title}
                </ThemeText>
            </View>
        </Pressable>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: rpx(160),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: rpx(24),
    },

    bottomIconWrapper: {
        width: rpx(240),
        height: rpx(116),
        marginHorizontal: rpx(12),
        borderRadius: rpx(18),
        alignItems: "center",
        justifyContent: "center",
    },
    bottomIconInner: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
    },
    bottomIconText: {
        marginTop: rpx(8),
    },
    dim: {
        opacity: 0.45,
    },
});
