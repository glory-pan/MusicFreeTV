import React from "react";
import SheetItem from "@/components/mediaItem/sheetItem";

interface IMusicSheetResultItemProps {
    item: IMusic.IMusicSheetItem;
    pluginHash: string;
    name?: string;
    focusOrder?: number;
}
export default function MusicSheetResultItem(
    props: IMusicSheetResultItemProps,
) {
    const { item, pluginHash, name, focusOrder } = props;

    return (
        <SheetItem
            sheetInfo={item}
            pluginHash={pluginHash}
            name={name}
            focusOrder={focusOrder}
        />
    );
}
