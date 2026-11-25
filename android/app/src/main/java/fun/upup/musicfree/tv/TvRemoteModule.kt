package `fun`.upup.musicfree.tv

import android.view.KeyEvent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * 电视遥控器按键桥。
 *
 * 职责：
 * 1. 把遥控器（D-pad / OK / MENU / 媒体键）的按下、抬起事件转发给 JS，
 *    交给 JS 侧的空间焦点引擎处理，从而摆脱手机端的触摸假设。
 * 2. 提供一个开关，在 JS 端输入框获得焦点时关闭拦截，让系统 IME 正常工作。
 */
class TvRemoteModule(private val reactAppContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactAppContext) {

    companion object {
        private const val EVENT_NAME = "TvRemoteKey"

        @Volatile
        var instance: TvRemoteModule? = null
            private set

        /** JS 侧是否希望拦截方向键（默认开启，电视场景始终由 JS 管理焦点） */
        @Volatile
        var captureEnabled: Boolean = true

        private fun keyName(keyCode: Int): String? = when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> "up"
            KeyEvent.KEYCODE_DPAD_DOWN -> "down"
            KeyEvent.KEYCODE_DPAD_LEFT -> "left"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_NUMPAD_ENTER -> "center"
            KeyEvent.KEYCODE_MENU -> "menu"
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "playPause"
            KeyEvent.KEYCODE_HEADSETHOOK -> "playPause"
            KeyEvent.KEYCODE_MEDIA_PLAY -> "play"
            KeyEvent.KEYCODE_MEDIA_PAUSE -> "pause"
            KeyEvent.KEYCODE_MEDIA_STOP -> "stop"
            KeyEvent.KEYCODE_MEDIA_NEXT,
            KeyEvent.KEYCODE_MEDIA_SKIP_FORWARD -> "next"
            KeyEvent.KEYCODE_MEDIA_PREVIOUS,
            KeyEvent.KEYCODE_MEDIA_SKIP_BACKWARD -> "previous"
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "forward"
            KeyEvent.KEYCODE_MEDIA_REWIND -> "rewind"
            else -> null
        }

        /**
         * Activity 中调用；返回 true 表示该按键已被 JS 焦点引擎接管，不再交给系统。
         */
        fun handleKeyEvent(event: KeyEvent): Boolean {
            val module = instance ?: return false
            if (!captureEnabled) {
                return false
            }
            val name = keyName(event.keyCode) ?: return false
            when (event.action) {
                KeyEvent.ACTION_DOWN -> if (event.repeatCount == 0) {
                    module.emit(name, "down")
                }
                KeyEvent.ACTION_UP -> module.emit(name, "up")
                else -> return false
            }
            return true
        }
    }

    private fun emit(key: String, action: String) {
        val payload = Arguments.createMap()
        payload.putString("key", key)
        payload.putString("action", action)
        try {
            reactAppContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_NAME, payload)
        } catch (e: Exception) {
            // JS 尚未加载完成时直接忽略
        }
    }

    override fun getName(): String = "TvRemote"

    override fun initialize() {
        super.initialize()
        instance = this
    }

    override fun invalidate() {
        if (instance === this) {
            instance = null
        }
        super.invalidate()
    }

    @ReactMethod
    fun setDpadCapture(enabled: Boolean) {
        captureEnabled = enabled
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // NativeEventEmitter 要求存在，无需实现
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        // NativeEventEmitter 要求存在，无需实现
    }
}
