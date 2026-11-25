import React from "react";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import ListItem from "@/components/base/listItem";
import { ImgAsset } from "@/constants/assetsConst";
import TitleAndTag from "./titleAndTag";

interface IAlbumResultsProps {
    albumItem: IAlbum.IAlbumItem;
    /** 遥控器焦点名 / 顺序：TV 列表要按名字把光环放回原来那一行 */
    name?: string;
    focusOrder?: number;
}

export default function AlbumItem(props: IAlbumResultsProps) {
    const { albumItem, name, focusOrder } = props;
    const navigate = useNavigate();

    return (
        <ListItem
            name={name}
            focusOrder={focusOrder}
            withHorizontalPadding
            heightType="big"
            onPress={() => {
                navigate(ROUTE_PATH.ALBUM_DETAIL, {
                    albumItem,
                });
            }}>
            <ListItem.ListItemImage
                uri={albumItem.artwork}
                fallbackImg={ImgAsset.albumDefault}
            />
            <ListItem.Content
                title={
                    <TitleAndTag
                        title={albumItem.title}
                        tag={albumItem.platform}
                    />
                }
                description={`${albumItem.artist ?? ""}    ${
                    albumItem.date ?? ""
                }`}
            />
        </ListItem>
        // <ListItem
        //     left={{
        //         artwork: albumItem.artwork,
        //         fallback: ImgAsset.albumDefault,
        //     }}
        //     title={albumItem.title}
        //     desc={`${albumItem.artist ?? ''}    ${albumItem.date ?? ''}`}
        //     tag={albumItem.platform}
        //     onPress={() => {
        //         navigate(ROUTE_PATH.ALBUM_DETAIL, {
        //             albumItem,
        //         });
        //     }}
        // />
    );
}
