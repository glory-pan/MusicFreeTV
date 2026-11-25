import React from "react";

import Header from "./header";
import Body from "./body";
import Divider from "@/components/base/divider";
import rpx from "@/utils/rpx";
import TvCardPanel from "../../base/tvCardPanel";

/**
 * 播放列表：电视端改成居中卡片（标题 + 当前列表 + 底部操作），
 * 光环落在某一行上，重开时回到上次选中的那首歌。
 */
export default function () {
    return (
        <TvCardPanel
            title="播放列表"
            rememberKey="playlist"
            firstFocusName="playlist:0"
            width={rpx(760)}>
            <Header />
            <Divider />
            <Body loading={false} />
        </TvCardPanel>
    );
}
