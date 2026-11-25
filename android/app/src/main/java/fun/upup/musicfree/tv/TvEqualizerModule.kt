package `fun`.upup.musicfree.tv

import android.media.audiofx.Equalizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * 电视端均衡器（参照 walkman-tv 的 EQ 能力）。
 *
 * 直接挂系统全局音频会话（session 0）的 AudioEffect.Equalizer，
 * 对当前在播的所有音频生效，不依赖播放器是否暴露 audioSessionId。
 */
class TvEqualizerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var equalizer: Equalizer? = null
    private var failed = false

    override fun getName() = "TvEqualizer"

    private fun ensure(): Equalizer? {
        if (equalizer != null || failed) {
            return equalizer
        }
        return try {
            val eq = Equalizer(0, 0)
            eq.enabled = false
            equalizer = eq
            eq
        } catch (e: Throwable) {
            failed = true
            null
        }
    }

    @ReactMethod
    fun getState(promise: Promise) {
        try {
            val eq = ensure()
            if (eq == null) {
                promise.resolve(null)
                return
            }
            val range = eq.bandLevelRange
            val bands = Arguments.createArray()
            for (band in 0 until eq.numberOfBands.toInt()) {
                val bandMap = Arguments.createMap()
                bandMap.putInt("index", band)
                val freq = try {
                    eq.getCenterFreq(band.toShort()) / 1000
                } catch (e: Throwable) {
                    0
                }
                bandMap.putInt("center", freq)
                bandMap.putInt("level", eq.getBandLevel(band.toShort()).toInt())
                bands.pushMap(bandMap)
            }
            val presets = Arguments.createArray()
            for (preset in 0 until eq.numberOfPresets.toInt()) {
                val presetMap = Arguments.createMap()
                presetMap.putInt("index", preset)
                presetMap.putString("name", eq.getPresetName(preset.toShort()))
                presets.pushMap(presetMap)
            }
            val state = Arguments.createMap()
            state.putBoolean("supported", true)
            state.putBoolean("enabled", eq.enabled)
            state.putInt("minLevel", range[0].toInt())
            state.putInt("maxLevel", range[1].toInt())
            state.putArray("bands", bands)
            state.putArray("presets", presets)
            promise.resolve(state)
        } catch (e: Throwable) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun setEnabled(enabled: Boolean, promise: Promise) {
        try {
            val eq = ensure()
            eq?.enabled = enabled
            promise.resolve(eq?.enabled ?: false)
        } catch (e: Throwable) {
            promise.reject("eq_enabled_failed", e)
        }
    }

    @ReactMethod
    fun setBandLevel(index: Int, level: Int, promise: Promise) {
        try {
            val eq = ensure()
            eq?.setBandLevel(index.toShort(), level.toShort())
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setPreset(index: Int, promise: Promise) {
        try {
            val eq = ensure()
            eq?.usePreset(index.toShort())
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }
}
