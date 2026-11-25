import React, { memo, useCallback, useEffect } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import MusicItem from "@/components/mediaItem/musicItem";
import { produce } from "immer";
import { useAtom, useSetAtom } from "jotai";
import {
    IEditorMusicItem,
    editingMusicListAtom,
    musicListChangedAtom,
} from "../store/atom";
import { TvFlashList } from "@/tv/scroll";
import { tvFocus } from "@/tv/focusStore";

import CheckBox from "@/components/base/checkbox";
import useColors from "@/hooks/useColors";
import Empty from "@/components/base/empty";

const ITEM_HEIGHT = rpx(120);

interface IMusicEditorItemProps {
    index: number;
    editorMusicItem: IEditorMusicItem;
}
function _MusicEditorItem(props: IMusicEditorItemProps) {
    const { index, editorMusicItem } = props;
    const setEditingMusicList = useSetAtom(editingMusicListAtom);

    const onPress = useCallback(() => {
        setEditingMusicList(
            produce(draft => {
                draft[index].checked = !draft[index].checked;
            }),
        );
    }, [index]);

    return (
        <MusicItem
            name={`editor:${index}`}
            focusOrder={index}
            musicItem={editorMusicItem.musicItem}
            left={() => (
                <View style={style.checkBox}>
                    <CheckBox checked={editorMusicItem.checked} />
                </View>
            )}
            showMoreIcon={false}
            showActions={false}
            itemPaddingRight={rpx(100)}
            onItemPress={() => {
                onPress();
                setMusicListChanged(true);
            }}
        />
    );
}

const MusicEditorItem = memo(
    _MusicEditorItem,
    (prev, curr) =>
        prev.editorMusicItem === curr.editorMusicItem &&
        prev.index === curr.index,
);

/** 音乐列表 */
const marginTop = rpx(88) * 2 + (StatusBar.currentHeight ?? 0);
export default function MusicList() {
    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);

    const renderItem = useCallback(
        ({ index, item }: any) => {
            return <MusicEditorItem editorMusicItem={item} index={index!} />;
        },
        [editingMusicList],
    );
    const colors = useColors();

    // 电视版：拖拽排序的列表在遥控器上根本渲染不出来（原来点"批量编辑"就是一片空白），
    // 这里换成普通的电视列表：上下键移、OK 勾选，勾完点"保存"。
    useEffect(() => {
        if (!editingMusicList?.length) {
            return;
        }
        const timers = [200, 600].map(delay =>
            setTimeout(() => tvFocus.focusByName("editor:0", true), delay),
        );
        return () => timers.forEach(clearTimeout);
    }, [editingMusicList?.length]);

    return editingMusicList?.length ? (
        <View style={style.listWrap}>
            <TvFlashList
                data={editingMusicList}
                estimatedItemSize={ITEM_HEIGHT}
                extraData={editingMusicList}
                renderItem={renderItem}
            />
        </View>
    ) : (
        <Empty />
    );
}

const style = StyleSheet.create({
    listWrap: {
        flex: 1,
    },
    checkBox: {
        height: "100%",
        justifyContent: "center",
        marginRight: rpx(16),
    },
});
