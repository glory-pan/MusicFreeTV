import React from "react";
import AlbumItem from "@/components/mediaItem/albumItem";

interface IAlbumResultsProps {
    item: IAlbum.IAlbumItem;
    index: number;
    name?: string;
    focusOrder?: number;
}

export default function AlbumResultItem(props: IAlbumResultsProps) {
    const { item: albumItem, name, focusOrder } = props;

    return (
        <AlbumItem albumItem={albumItem} name={name} focusOrder={focusOrder} />
    );
}
