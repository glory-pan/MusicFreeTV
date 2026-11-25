import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";
import Loading from "@/components/base/loading";
import { RequestStateCode } from "@/constants/commonConst";
import useOrientation from "@/hooks/useOrientation";
import rpx from "@/utils/rpx";
import { TvFlashList as FlashList } from "@/tv/scroll";
import { useAtomValue } from "jotai";
import React, { memo, useCallback, useEffect, useState } from "react";
import useSearch from "../../hooks/useSearch";
import { ISearchResult, queryAtom } from "../../store/atoms";
import { renderMap } from "./results";
import { tvFocus } from "@/tv/focusStore";
import { useTvPageFirstFocus } from "@/tv/firstFocus";

interface IResultWrapperProps<
    T extends ICommon.SupportMediaType = ICommon.SupportMediaType,
> {
    tab: T;
    pluginHash: string;
    pluginName: string;
    searchResult: ISearchResult<T>;
    pluginSearchResultRef: React.MutableRefObject<ISearchResult<T>>;
}
function ResultWrapper(props: IResultWrapperProps) {
    const { tab, pluginHash, searchResult, pluginSearchResultRef } = props;
    const search = useSearch();
    const [searchState, setSearchState] = useState<RequestStateCode>(
        searchResult?.state ?? RequestStateCode.IDLE,
    );
    const orientation = useOrientation();
    const query = useAtomValue(queryAtom);

    const ResultComponent = renderMap[tab]!;
    const data: any = searchResult?.data ?? [];

    const keyExtractor = useCallback(
        (item: any, i: number) => `${i}-${item.platform}-${item.id}`,
        [],
    );

    useEffect(() => {
        if (searchState === RequestStateCode.IDLE) {
            search(query, 1, tab, pluginHash);
        }
    }, []);

    useEffect(() => {
        setSearchState(searchResult?.state ?? RequestStateCode.IDLE);
    }, [searchResult]);

    // 焦点名前缀带上 tab + 插件，避免不同页签/不同插件的列表互相抢光环
    const namePrefix = `sr:${tab}:${pluginHash}`;

    // 进页面/结果回来后把光环放到第一条结果上（之前搜索结果行根本没有焦点名）
    useEffect(() => {
        if (!data?.length) {
            return;
        }
        tvFocus.focusByName(`${namePrefix}:0`, true);
        const timers = [260, 700, 1400].map(delay =>
            setTimeout(() => {
                const focused = tvFocus.getFocusedNode();
                if (!focused?.debugName?.startsWith(namePrefix)) {
                    tvFocus.focusByName(`${namePrefix}:0`, true) ||
                        tvFocus.focusFirstInActiveLayer();
                }
            }, delay),
        );
        return () => timers.forEach(clearTimeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.length, namePrefix]);
    useTvPageFirstFocus();

    const renderItem = ({ item, index }: any) => (
        <ResultComponent
            item={item}
            index={index}
            name={`${namePrefix}:${index}`}
            focusOrder={index}
            pluginHash={pluginHash}
            pluginSearchResultRef={pluginSearchResultRef}
        />
    );

    return searchState === RequestStateCode.PENDING_FIRST_PAGE ? (
        <Loading />
    ) : (
        <FlashList
            extraData={searchState}
            ListEmptyComponent={<ListEmpty state={searchState} onRetry={() => {
                search(query, 1, tab, pluginHash);
            }} />}
            ListFooterComponent={data?.length ? <ListFooter state={searchState} onRetry={() => {
                search(query, undefined, tab, pluginHash);
            }} /> : null}
            data={data}
            refreshing={false}
            onRefresh={() => {
                search(query, 1, tab, pluginHash);
            }}
            onEndReached={() => {
                (searchState === RequestStateCode.PARTLY_DONE ||
                    searchState === RequestStateCode.IDLE) &&
                    search(undefined, undefined, tab, pluginHash);
            }}
            estimatedItemSize={tab === "sheet" ? rpx(306) : rpx(120)}
            numColumns={
                tab === "sheet" ? (orientation === "vertical" ? 3 : 4) : 1
            }
            renderItem={renderItem}
            keyExtractor={keyExtractor}
        />
    );
}

export default memo(ResultWrapper);