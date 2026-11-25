import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";
import Loading from "@/components/base/loading";
import { RequestStateCode } from "@/constants/commonConst";
import useOrientation from "@/hooks/useOrientation";
import rpx from "@/utils/rpx";
import { TvFlashList as FlashList } from "@/tv/scroll";
import { useAtomValue } from "jotai";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
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

    const lastLoadRef = React.useRef(0);

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

    // 出错自动再试一次（间隔 2.5 秒）：网络抖一下不该让整块停在"出错啦"，
    // 以前这块一红就只能退出 App 重开。
    const autoRetriedRef = useRef(0);
    useEffect(() => {
        if (searchState !== RequestStateCode.ERROR) {
            autoRetriedRef.current = 0;
            return;
        }
        if (autoRetriedRef.current >= 2) {
            return;
        }
        autoRetriedRef.current += 1;
        const timer = setTimeout(() => {
            search(query, 1, tab, pluginHash);
        }, 2500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchState]);

    // 焦点名前缀带上 tab + 插件，避免不同页签/不同插件的列表互相抢光环
    const namePrefix = `sr:${tab}:${pluginHash}`;

    // 进页面/结果回来后把光环放到第一条结果上。
    // 注意：这里以前在 260/700/1400ms 各补一次"抢焦点"，结果用户正在按方向键往下走，
    // 1.4 秒后定时器一响，光环被打回第一行（实机看起来就是"焦点自己跳回上面"）。
    // 现在每个页签/插件只落一次，且列表增长（翻页）时不再重置。
    const focusedPrefixRef = useRef("");
    useEffect(() => {
        if (!data?.length) {
            return;
        }
        if (focusedPrefixRef.current === namePrefix) {
            return;
        }
        focusedPrefixRef.current = namePrefix;
        tvFocus.focusByName(`${namePrefix}:0`, true);
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
                // FlashList 在内容不足一屏时会连续触发 onEndReached，
                // 每次都发一次请求 → 请求叠在一起、网络一堵就整块出错。
                const now = Date.now();
                if (now - lastLoadRef.current < 1200) {
                    return;
                }
                lastLoadRef.current = now;
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