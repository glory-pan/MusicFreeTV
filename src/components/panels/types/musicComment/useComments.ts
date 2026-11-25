import { atom, getDefaultStore, useAtomValue } from "jotai";
import { RequestStateCode } from "@/constants/commonConst.ts";
import { useCallback, useEffect, useRef } from "react";
import { isSameMediaItem } from "@/utils/mediaUtils";
import PluginManager from "@/core/pluginManager";


const commentsAtom = atom<{
    mediaItem: ICommon.IMediaBase | null;
    comments: IMedia.IComment[];
    page: number;
    state: RequestStateCode;
    /** 该平台歌曲的评论总数，插件拿不到时为 0 */
    total: number;
}>({
    mediaItem: null,
    comments: [],
    page: 1,
    state: RequestStateCode.PENDING_FIRST_PAGE,
    total: 0,
});

export default function useComments(mediaItem: ICommon.IMediaBase) {
    const mountedRef = useRef(true);
    const commentsValue = useAtomValue(commentsAtom);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);


    const getComments = useCallback(async () => {
        const currentCommentsInfo = getDefaultStore().get(commentsAtom);
        let { comments, page, state } = currentCommentsInfo;


        let nextPage = page;
        let nextComments: IMedia.IComment[] = [];
        let nextTotal = currentCommentsInfo.total || 0;


        // 如果不是同一首歌，就重置评论
        if (!isSameMediaItem(mediaItem, currentCommentsInfo.mediaItem)) {
            nextPage = 1;
            nextComments = [];
            nextTotal = 0;
        } else {
            // 如果是同一首歌，判断状态
            if (state === RequestStateCode.PENDING_FIRST_PAGE || state === RequestStateCode.PENDING_REST_PAGE) {
                return; // 正在加载中，直接返回
            }

            // 如果是 Finished 状态 直接返回
            if (state === RequestStateCode.FINISHED) {
                return;
            }

            if (state === RequestStateCode.ERROR) {
                // 出错状态，从当前页继续请求
                nextPage = page;
            } else {
                // 其他状态，从下一页开始请求
                nextPage = page + 1;
            }

            nextComments = comments;
        }

        if (!mediaItem) {
            return;
        }

        const plugin = PluginManager.getByMedia(mediaItem);
        if (!plugin) {
            return;
        }

        getDefaultStore().set(commentsAtom, {
            mediaItem,
            comments,
            page: nextPage,
            state:
                nextPage === 1
                    ? RequestStateCode.PENDING_FIRST_PAGE
                    : RequestStateCode.PENDING_REST_PAGE,
            total: nextTotal,
        });

        try {
            const result = await plugin.methods
                .getMusicComments(mediaItem as any, nextPage);

            // 查看是否是同一首歌
            if (mountedRef.current && isSameMediaItem(mediaItem, getDefaultStore().get(commentsAtom).mediaItem)) {
                nextComments = nextComments.concat(result.data || []);
                const resultTotal = Number((result as any).total || 0);
                if (resultTotal > 0) {
                    nextTotal = resultTotal;
                }

                getDefaultStore().set(commentsAtom, {
                    mediaItem,
                    comments: nextComments,
                    page: nextPage,
                    state:
                        result.isEnd === false
                            ? RequestStateCode.PARTLY_DONE
                            : RequestStateCode.FINISHED,
                    total: nextTotal,
                });
            }
        } catch (error) {
            if (mountedRef.current && isSameMediaItem(mediaItem, getDefaultStore().get(commentsAtom).mediaItem)) {
                getDefaultStore().set(commentsAtom, {
                    mediaItem,
                    comments: nextComments,
                    page: nextPage,
                    state: RequestStateCode.ERROR,
                    total: nextTotal,
                });
            }
        }

    }, [mediaItem]);


    useEffect(() => {
        getComments();
    }, []);


    return [
        commentsValue.state,
        commentsValue.comments,
        getComments,
        commentsValue.total,
    ] as const;
}
