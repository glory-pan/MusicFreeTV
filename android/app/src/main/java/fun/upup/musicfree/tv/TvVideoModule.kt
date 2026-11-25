package `fun`.upup.musicfree.tv

import android.graphics.Matrix
import android.media.AudioAttributes
import android.graphics.SurfaceTexture
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.net.Uri
import android.view.Surface
import android.view.TextureView
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import java.lang.ref.WeakReference

/**
 * 电视端 MV 视频播放的原生视图（TextureView + MediaPlayer）。
 *
 * 1) 用 TextureView 而不是 VideoView：VideoView 内部是 SurfaceView，
 *    在 RN 的视图树里会被别的图层盖住，实机上表现为"有声音没画面"。
 * 2) 支持 headers：B 站 CDN 不带 Referer 会直接 403，MediaPlayer 的
 *    setDataSource(Context, Uri, Map) 可以把请求头带上。
 */
class TvVideoSurface(context: ThemedReactContext) : FrameLayout(context) {

    private var focusRequest: AudioFocusRequest? = null

    private val textureView = TextureView(context)
    private var player: MediaPlayer? = null
    private var surface: Surface? = null
    private var source: String? = null
    private var headers: Map<String, String> = emptyMap()
    private var paused = false
    private var speed = 1f
    private var pendingSeekMs = -1

    init {
        setBackgroundColor(android.graphics.Color.BLACK)
        addView(
            textureView,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
        )
        textureView.surfaceTextureListener = object :
            TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(
                st: SurfaceTexture,
                width: Int,
                height: Int,
            ) {
                surface = Surface(st).also { surface = it }
                openSource()
            }

            override fun onSurfaceTextureSizeChanged(
                st: SurfaceTexture,
                width: Int,
                height: Int,
            ) {
                applyScale()
            }

            override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
                releasePlayer()
                surface?.release()
                surface = null
                return true
            }

            override fun onSurfaceTextureUpdated(st: SurfaceTexture) {}
        }
    }

    // 部分盒子（rockchip/Android TV）TextureView 首帧会被合层吞掉：
    // 起播后连续几次轻微重排+重绘，把第一帧挤出来
    private fun nudgeFrames() {
        (listOf(120L, 400L, 900L, 1800L)).forEach { delay ->
            postDelayed({
                try {
                    applyScale()
                    textureView.invalidate()
                    requestLayout()
                } catch (_: Throwable) {
                }
            }, delay)
        }
    }

    /**
     * 首帧看门狗：prepared 之后 6 秒内如果 currentPosition 一直不动，
     * 每秒再挤一次画面（有些盒子的合成器要等到下一次跨帧才肯显示视频层）。
     */
    private fun startFirstFrameWatchdog() {
        (1..6).forEach { sec ->
            postDelayed({
                try {
                    val p = player ?: return@postDelayed
                    if (lastError != null) return@postDelayed
                    if (p.currentPosition < 300) {
                        applyScale()
                        textureView.invalidate()
                        requestLayout()
                    }
                } catch (_: Throwable) {
                }
            }, sec * 1000L)
        }
    }

    fun setSourceHeaders(map: Map<String, String>) {
        if (map == headers) {
            return
        }
        headers = map
        // 请求头变了必须重新 prepare，否则 MediaPlayer 沿用旧头（B 站会 403）
        if (source != null) {
            releasePlayer()
            openSource()
        }
    }

    fun setSource(url: String?) {
        if (url.isNullOrEmpty() || url == source) {
            return
        }
        source = url
        releasePlayer()
        openSource()
    }

    fun setPaused(value: Boolean) {
        paused = value
        val p = player ?: return
        try {
            if (value) {
                if (p.isPlaying) p.pause()
            } else {
                if (!p.isPlaying) p.start()
                nudgeFrames()
            }
        } catch (_: Throwable) {
        }
    }

    fun setSpeed(value: Float) {
        speed = value
        applySpeed()
    }

    private fun applySpeed() {
        val p = player ?: return
        if (speed <= 1.001f && speed >= 0.999f) {
            return
        }
        try {
            val params = p.playbackParams
            params.speed = speed
            p.playbackParams = params
        } catch (e: Throwable) {
            lastError = "倍速设置失败：" + (e.message ?: "")
        }
    }

    private fun openSource() {
        val url = source ?: return
        val st = textureView.surfaceTexture ?: return
        val usableSurface = surface ?: Surface(st).also { surface = it }
        try {
            requestAudioFocus()
            lastError = null
            retriedWithoutHeaders = false
            val mp = MediaPlayer()
            player = mp
            mp.setSurface(usableSurface)
            try {
                mp.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
                        .build(),
                )
            } catch (_: Throwable) {
            }
            try {
                @Suppress("DEPRECATION")
                mp.setAudioStreamType(AudioManager.STREAM_MUSIC)
            } catch (_: Throwable) {
            }
            try {
                val v0 = if (muted) 0f else audioVolume
                mp.setVolume(v0, v0)
            } catch (_: Throwable) {
            }
            if (headers.isNotEmpty()) {
                mp.setDataSource(context, Uri.parse(url), headers)
            } else {
                mp.setDataSource(context, Uri.parse(url))
            }
            mp.setOnPreparedListener { p ->
                try {
                    p.setVideoScalingMode(
                        MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT,
                    )
                } catch (_: Throwable) {
                }
                applyScale()
                applySpeed()
                if (pendingSeekMs >= 0) {
                    p.seekTo(pendingSeekMs)
                    pendingSeekMs = -1
                }
                if (!paused) {
                    p.start()
                }
                // 起播前后多抢几次焦点：后台的歌曲播放器（ExoPlayer）暂停时不一定
                // 立刻释放焦点，它一回头就把 MV 的音频路顶掉 → 有画面没声音
                listOf(200L, 900L, 2200L, 4500L).forEach { delay ->
                    postDelayed({
                        try {
                            if (player === p) {
                                requestAudioFocus()
                                val v1 = if (muted) 0f else audioVolume
                                p.setVolume(v1, v1)
                            }
                        } catch (_: Throwable) {
                        }
                    }, delay)
                }
                startFirstFrameWatchdog()
            }
            mp.setOnVideoSizeChangedListener { _, _, _ -> applyScale() }
            mp.setOnErrorListener { _, what, extra ->
                // 带自定义头（B 站要 Referer）时个别盒子会直接 code=-38：
                // 先去掉头重试一次，还不行再交给 JS 切内嵌播放
                if (headers.isNotEmpty() && !retriedWithoutHeaders) {
                    retriedWithoutHeaders = true
                    savedHeaders = headers
                    headers = emptyMap()
                    releasePlayer()
                    openSource()
                    headers = savedHeaders
                    savedHeaders = emptyMap()
                    return@setOnErrorListener true
                }
                lastError = "视频解码失败 code=$what extra=$extra"
                true
            }
            mp.prepareAsync()
        } catch (e: Throwable) {
            lastError = e.message ?: "视频加载失败"
        }
    }

    private fun requestAudioFocus(force: Boolean = false) {
        // 视频静音时（歌曲音轨模式下）绝对不能抢焦点：同一个 App 里的 ExoPlayer
        // 收到 AUDIOFOCUS_LOSS 会立刻暂停，表现就是“进 MV 响一秒就没声了”
        // force=true 是给独立配乐播放器用的：它自己就是发声的那个，需要焦点
        if (muted && !force) {
            return
        }
        try {
            val ctx = context
            val am = ctx?.getSystemService(AudioManager::class.java) ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
                            .build(),
                    )
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener { change ->
                        if (change == AudioManager.AUDIOFOCUS_LOSS ||
                            change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
                        ) {
                            postDelayed({ requestAudioFocus() }, 500L)
                        }
                    }
                    .build()
                focusRequest = req
                am.requestAudioFocus(req)
            } else {
                @Suppress("DEPRECATION")
                am.requestAudioFocus(
                    null,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN,
                )
            }
        } catch (_: Throwable) {
        }
    }

    private fun abandonAudioFocus() {
        try {
            val am = context?.getSystemService(AudioManager::class.java) ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest?.let { am.abandonAudioFocusRequest(it) }
                focusRequest = null
            } else {
                @Suppress("DEPRECATION")
                am.abandonAudioFocus(null)
            }
        } catch (_: Throwable) {
        }
    }

    private fun releasePlayer() {
        abandonAudioFocus()
        val p = player
        player = null
        try {
            p?.stop()
        } catch (_: Throwable) {
        }
        try {
            p?.release()
        } catch (_: Throwable) {
        }
    }

    /** 额外放大倍数：用于裁掉画面边缘的水印（1.0 表示不裁） */
    /** 去掉自定义头重试过一次？ */
    private var retriedWithoutHeaders = false
    private var savedHeaders: Map<String, String> = emptyMap()

    var zoomCrop: Float = 1f
        set(value) {
            field = if (value <= 0f || value > 2f) 1f else value
            applyScale()
        }

    /** 铺满整屏：等比放大后裁掉多余部分，不出现上下黑边 */
    private fun applyScale() {
        val p = player ?: return
        val vw = try {
            p.videoWidth
        } catch (_: Throwable) {
            0
        }
        val vh = try {
            p.videoHeight
        } catch (_: Throwable) {
            0
        }
        val cw = width
        val ch = height
        if (vw <= 0 || vh <= 0 || cw <= 0 || ch <= 0) {
            return
        }
        val scale = Math.max(cw.toFloat() / vw, ch.toFloat() / vh) * zoomCrop
        val matrix = Matrix()
        matrix.setScale(scale, scale)
        matrix.postTranslate((cw - vw * scale) / 2f, (ch - vh * scale) / 2f)
        try {
            textureView.setTransform(matrix)
        } catch (_: Throwable) {
        }
    }

    override fun onLayout(
        changed: Boolean,
        left: Int,
        top: Int,
        right: Int,
        bottom: Int,
    ) {
        super.onLayout(changed, left, top, right, bottom)
        applyScale()
    }

    fun seekTo(ms: Int) {
        val p = player
        if (p == null) {
            pendingSeekMs = ms
            return
        }
        try {
            p.seekTo(ms)
        } catch (_: Throwable) {
            pendingSeekMs = ms
        }
    }

    fun stopPlayback() {
        releasePlayer()
        releaseAudio()
        source = null
        audioUrl = null
    }

    fun status(): Map<String, Any?> {
        val p = player
        val map = mutableMapOf<String, Any?>()
        if (p == null) {
            map["ready"] = false
            map["error"] = lastError
            return map
        }
        map["ready"] = true
        map["error"] = lastError
        try {
            map["position"] = p.currentPosition
            map["duration"] = p.duration
            map["playing"] = p.isPlaying
            // 这条流到底有没有音轨：没有的话画面照放但永远没声音，得让 JS 知道
            map["hasAudio"] = hasAudioTrack(p)
            map["audioTracks"] = audioTrackCount(p)
            map["videoTracks"] = videoTrackCount(p)
            map["trackReadable"] = trackReadable(p)
            map["muted"] = muted
            map["volume"] = audioVolume
            map["audioFormat"] = audioFormatText(p)
            map["streamVolume"] = systemMusicVolume()
        } catch (e: Throwable) {
            map["error"] = e.message
        }
        return map
    }

    /** 流的音轨探测：prepared 后才能读到 trackInfo，读不到就当作“未知” */
    private var audioVolume = 1f

    /** JS 侧把视频静音（改用歌曲音轨出声时用） */
    private var muted = false

    // ============ MV 的“配乐”播放器 ============
    // 晴天这类 B 站流是纯画面（trackInfo 里 0 条音轨），之前靠 App 内歌曲播放器出声，
    // 但它会被别的播放器抢焦点自动暂停，表现就是“响一秒就没声”。
    // 这里用一个独立的 MediaPlayer 只播音频，和视频播放器解耦，谁也不影响谁。
    private var audioPlayer: MediaPlayer? = null
    private var audioUrl: String? = null
    private var audioHeaders: Map<String, String> = emptyMap()
    private var audioPaused = false
    private var audioError: String? = null
    private var audioPendingSeekMs = -1

    fun setAudioSource(url: String?, headers: Map<String, String>) {
        if (url == audioUrl && headers == audioHeaders) {
            return
        }
        audioUrl = url
        audioHeaders = headers
        audioError = null
        releaseAudio()
        if (url.isNullOrEmpty()) {
            return
        }
        try {
            val p = MediaPlayer()
            audioPlayer = p
            try {
                p.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build(),
                )
            } catch (_: Throwable) {
            }
            try {
                @Suppress("DEPRECATION")
                p.setAudioStreamType(AudioManager.STREAM_MUSIC)
            } catch (_: Throwable) {
            }
            if (headers.isEmpty()) {
                p.setDataSource(context, Uri.parse(url))
            } else {
                p.setDataSource(context, Uri.parse(url), headers)
            }
            p.setOnPreparedListener { mp ->
                try {
                    mp.setVolume(1f, 1f)
                } catch (_: Throwable) {
                }
                requestAudioFocus(true)
                if (!audioPaused) {
                    try {
                        mp.start()
                    } catch (_: Throwable) {
                    }
                }
                if (audioPendingSeekMs >= 0) {
                    try {
                        mp.seekTo(audioPendingSeekMs)
                    } catch (_: Throwable) {
                    }
                    audioPendingSeekMs = -1
                }
            }
            p.setOnErrorListener { _, what, extra ->
                // 单独记，别污染视频的错误状态（否则 JS 会把画面误判成解码失败去切网页）
                audioError = "code=$what extra=$extra"
                true
            }
            p.prepareAsync()
        } catch (e: Throwable) {
            lastError = "配乐加载失败：" + (e.message ?: "")
        }
    }

    fun setAudioPaused(value: Boolean) {
        audioPaused = value
        val p = audioPlayer ?: return
        try {
            if (value) {
                p.pause()
            } else {
                requestAudioFocus(true)
                p.start()
            }
        } catch (_: Throwable) {
        }
    }

    fun setAudioSpeed(value: Float) {
        val p = audioPlayer ?: return
        try {
            val params = p.playbackParams
            params.speed = value
            p.playbackParams = params
        } catch (_: Throwable) {
        }
    }

    fun seekAudio(ms: Int) {
        val p = audioPlayer ?: return
        try {
            p.seekTo(ms)
        } catch (_: Throwable) {
            audioPendingSeekMs = ms
        }
    }

    fun audioStatus(): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>()
        val p = audioPlayer
        if (p == null) {
            map["ready"] = false
            return map
        }
        map["ready"] = true
        try {
            map["position"] = p.currentPosition
            map["playing"] = p.isPlaying
            map["duration"] = p.duration
            map["audioError"] = audioError
        } catch (_: Throwable) {
        }
        return map
    }

    fun releaseAudio() {
        val p = audioPlayer
        audioPlayer = null
        try {
            p?.stop()
        } catch (_: Throwable) {
        }
        try {
            p?.release()
        } catch (_: Throwable) {
        }
    }

    fun setMuted(value: Boolean) {
        muted = value
        applyVolume()
        if (value) {
            abandonAudioFocus()
        } else {
            requestAudioFocus()
        }
    }

    private fun applyVolume() {
        val p = player ?: return
        val v = if (muted) 0f else audioVolume
        try {
            p.setVolume(v, v)
        } catch (_: Throwable) {
        }
    }

    /** 音轨的技术参数（mime / 采样率 / 声道）—— 用来判断“有音轨但盒子放不出”这类问题 */
    private fun audioFormatText(p: MediaPlayer): String {
        return try {
            val tracks = p.trackInfo ?: return ""
            for (t in tracks) {
                if (t.trackType != MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO) {
                    continue
                }
                val f = t.format
                val mime = try {
                    f.getString("mime") ?: ""
                } catch (_: Throwable) {
                    ""
                }
                val sr = try {
                    f.getInteger("sample-rate")
                } catch (_: Throwable) {
                    0
                }
                val ch = try {
                    f.getInteger("channel-count")
                } catch (_: Throwable) {
                    0
                }
                return mime.replace("audio/", "") + " " + sr + "Hz " + ch + "ch"
            }
            ""
        } catch (_: Throwable) {
            ""
        }
    }

    /** 盒子当前的媒体音量档位：档位是 0 的话，任何播放器都出不来声 */
    private fun systemMusicVolume(): Int {
        return try {
            val am = context?.getSystemService(AudioManager::class.java)
            am?.getStreamVolume(AudioManager.STREAM_MUSIC) ?: -1
        } catch (_: Throwable) {
            -1
        }
    }

    /** 音轨条数：B 站的纯画面稿（dash 视频流 / UP 主静音版）这里是 0 */
    private fun audioTrackCount(p: MediaPlayer): Int {
        return try {
            val tracks = p.trackInfo ?: return 0
            tracks.count { it.trackType == MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO }
        } catch (_: Throwable) {
            0
        }
    }

    private fun videoTrackCount(p: MediaPlayer): Int {
        return try {
            val tracks = p.trackInfo ?: return 0
            tracks.count { it.trackType == MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_VIDEO }
        } catch (_: Throwable) {
            0
        }
    }

    /**
     * trackInfo 到底读出来没有：一律 UNKNOWN 或空，说明盒子没告诉我们音轨情况，
     * 这时不能断定“没音轨”，否则会误切源。
     */
    private fun trackReadable(p: MediaPlayer): Boolean {
        return try {
            val tracks = p.trackInfo ?: return false
            if (tracks.isEmpty()) return false
            !tracks.any { it.trackType == MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_UNKNOWN }
        } catch (_: Throwable) {
            false
        }
    }

    private fun hasAudioTrack(p: MediaPlayer): Boolean = audioTrackCount(p) > 0

    companion object {
        var current: WeakReference<TvVideoSurface>? = null
        var lastError: String? = null
    }
}

class TvVideoViewManager : SimpleViewManager<TvVideoSurface>() {

    override fun getName() = REACT_CLASS

    override fun createViewInstance(context: ThemedReactContext): TvVideoSurface {
        val view = TvVideoSurface(context)
        TvVideoSurface.current = WeakReference(view)
        return view
    }

    @ReactProp(name = "headers")
    fun setHeaders(view: TvVideoSurface, headers: ReadableMap?) {
        view.setSourceHeaders(readableToStringMap(headers))
    }

    @ReactProp(name = "muted", defaultBoolean = false)
    fun setMuted(view: TvVideoSurface, value: Boolean) {
        view.setMuted(value)
    }

    @ReactProp(name = "zoomCrop", defaultFloat = 1f)
    fun setZoomCrop(view: TvVideoSurface, zoom: Float) {
        view.zoomCrop = zoom
    }

    @ReactProp(name = "sourceHeaders")
    fun setSourceHeaders(view: TvVideoSurface, headers: ReadableMap?) {
        view.setSourceHeaders(readableToStringMap(headers))
    }

    private fun readableToStringMap(map: ReadableMap?): Map<String, String> {
        if (map == null) {
            return emptyMap()
        }
        val out = HashMap<String, String>()
        val it = map.keySetIterator()
        while (it.hasNextKey()) {
            val key = it.nextKey()
            val value = try {
                map.getString(key)
            } catch (_: Throwable) {
                null
            }
            if (key != null && value != null) {
                out[key] = value
            }
        }
        return out
    }

    @ReactProp(name = "source")
    fun setSource(view: TvVideoSurface, source: String?) {
        view.setSource(source)
    }

    @ReactProp(name = "paused", defaultBoolean = false)
    fun setPaused(view: TvVideoSurface, paused: Boolean) {
        view.setPaused(paused)
    }

    @ReactProp(name = "speed", defaultFloat = 1f)
    fun setSpeed(view: TvVideoSurface, speed: Float) {
        view.setSpeed(if (speed <= 0f) 1f else speed)
    }

    companion object {
        const val REACT_CLASS = "TvVideoView"
    }
}

class TvVideoModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "TvVideo"

    private fun target(): TvVideoSurface? = TvVideoSurface.current?.get()

    @ReactMethod
    fun play(promise: Promise) {
        try {
            target()?.setPaused(false)
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun pause(promise: Promise) {
        try {
            target()?.setPaused(true)
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun seekTo(position: Double, promise: Promise) {
        try {
            target()?.seekTo(position.toInt())
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setSpeed(speed: Double, promise: Promise) {
        try {
            target()?.setSpeed(speed.toFloat())
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            target()?.stopPlayback()
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setMvAudio(url: String?, headers: com.facebook.react.bridge.ReadableMap?, promise: Promise) {
        try {
            val view = target()
            view?.setAudioSource(url, readableToStringMap(headers))
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun mvAudioPlay(promise: Promise) {
        try {
            target()?.setAudioPaused(false)
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun mvAudioPause(promise: Promise) {
        try {
            target()?.setAudioPaused(true)
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun mvAudioSpeed(speed: Double, promise: Promise) {
        try {
            target()?.setAudioSpeed(speed.toFloat())
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun mvAudioSeek(position: Double, promise: Promise) {
        try {
            target()?.seekAudio(position.toInt())
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun mvAudioStop(promise: Promise) {
        try {
            target()?.releaseAudio()
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getMvAudioStatus(promise: Promise) {
        val map = Arguments.createMap()
        val st = target()?.audioStatus() ?: emptyMap<String, Any?>()
        map.putBoolean("ready", st["ready"] as? Boolean ?: false)
        (st["position"] as? Number)?.let { map.putInt("position", it.toInt()) }
        (st["duration"] as? Number)?.let { map.putInt("duration", it.toInt()) }
        map.putBoolean("playing", st["playing"] as? Boolean ?: false)
        map.putString("audioError", st["audioError"] as? String)
        promise.resolve(map)
    }

    private fun readableToStringMap(map: com.facebook.react.bridge.ReadableMap?): Map<String, String> {
        if (map == null) {
            return emptyMap()
        }
        val out = HashMap<String, String>()
        val it = map.keySetIterator()
        while (it.hasNextKey()) {
            val key = it.nextKey()
            val value = try {
                map.getString(key)
            } catch (_: Throwable) {
                null
            }
            if (key != null && value != null) {
                out[key] = value
            }
        }
        return out
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        val view = target()
        val map = Arguments.createMap()
        if (view == null) {
            map.putBoolean("ready", false)
            map.putString("error", TvVideoSurface.lastError)
            promise.resolve(map)
            return
        }
        val st = view.status()
        map.putBoolean("ready", st["ready"] as? Boolean ?: false)
        map.putString("error", st["error"] as? String)
        (st["position"] as? Number)?.let { map.putInt("position", it.toInt()) }
        (st["duration"] as? Number)?.let { map.putInt("duration", it.toInt()) }
        map.putBoolean("playing", st["playing"] as? Boolean ?: false)
        map.putBoolean("hasAudio", st["hasAudio"] as? Boolean ?: true)
        (st["audioTracks"] as? Number)?.let {
            map.putInt("audioTracks", it.toInt())
        }
        (st["videoTracks"] as? Number)?.let {
            map.putInt("videoTracks", it.toInt())
        }
        map.putBoolean("trackReadable", st["trackReadable"] as? Boolean ?: false)
        map.putBoolean("muted", st["muted"] as? Boolean ?: false)
        map.putString("audioFormat", st["audioFormat"] as? String ?: "")
        (st["streamVolume"] as? Number)?.let {
            map.putInt("streamVolume", it.toInt())
        }
        (st["volume"] as? Number)?.let {
            map.putDouble("volume", it.toDouble())
        }
        promise.resolve(map)
    }
}
