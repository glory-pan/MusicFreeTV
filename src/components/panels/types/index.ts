import AddToMusicSheet from "./addToMusicSheet";
import AssociateLrc from "./associateLrc";
import ColorPicker from "./colorPicker";
import ImportMusicSheet from "./importMusicSheet";
import MusicItemOptions from "./musicItemOptions";
import MusicQuality from "./musicQuality";
import CreateMusicSheet from "./createMusicSheet";
import PlayList from "./playList";
import PlayRate from "./playRate";
import SearchLrc from "./searchLrc";
import SetFontSize from "./setFontSize";
import SetLyricOffset from "./setLyricOffset";
import SetUserVariables from "./setUserVariables";
import SheetTags from "./sheetTags";
import SimpleInput from "./simpleInput";
import SimpleSelect from "./simpleSelect";
import TimingClose from "./timingClose";
import ImageViewer from "./imageViewer";
import MusicComment from "./musicComment";
import MusicItemLyricOptions from "./musicItemLyricOptions";
import MusicMoreOptions from "./musicMoreOptions";
import EditMusicSheetInfo from "./editMusicSheetInfo";
import PluginInstallPanel from "./pluginInstallPanel";
import TvActionMenu from "./tvActionMenu";

export default {
    /** 电视端页面「更多」卡片（标题栏 ⋯ 的替代） */
    TvActionMenu,
    /** 安装插件（musicfree音源上传 / 插件维护 两栏） */
    PluginInstallPanel,
    /** 加入歌单 */
    AddToMusicSheet,
    /** 歌曲选项 */
    MusicItemOptions,
    /** 新建歌单 */
    CreateMusicSheet,
    /** 导入歌单 */
    ImportMusicSheet,
    /** 当前播放列表 */
    PlayList: PlayList,
    /** 关联歌词 */
    AssociateLrc,
    /** 简单的输入 */
    SimpleInput,
    /** 定时关闭 */
    TimingClose,
    /** 音质选择 */
    MusicQuality,
    /** 播放页「更多」卡片 */
    MusicMoreOptions,
    /** 播放速度 */
    PlayRate,
    /** 歌单tag */
    SheetTags,
    /** 搜索歌词 */
    SearchLrc,
    /** 简单的选择 */
    SimpleSelect,
    /** 颜色选择器 */
    ColorPicker,
    /** 设置插件用户变量 */
    SetUserVariables,
    /** 设置字体 */
    SetFontSize,
    /** 设置歌词偏移 */
    SetLyricOffset,
    /** 图片阅读器 */
    ImageViewer,
    /** 音乐评论 */
    MusicComment,
    MusicItemLyricOptions,
    EditMusicSheetInfo,
};
