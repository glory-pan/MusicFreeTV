package `fun`.upup.musicfree.tv

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 应用内更新：下载 APK 到应用私有目录，再调起系统安装器。
 *
 * 为什么不用 Linking 打开浏览器：TV 盒子上很多没有浏览器，而且用户
 * 要的是"在软件里就能更新下载"，下载 + 安装得自己做完。
 */
class TvUpdaterModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    private var received = 0L
    private var total = -1L
    private var done = false
    private var running = false
    private var error = ""

    override fun getName(): String = "TvUpdater"

    private fun updateDir(): File =
        File(ctx.getExternalFilesDir(null) ?: ctx.filesDir, "updates").apply { mkdirs() }

    @ReactMethod
    fun download(url: String, fileName: String, promise: Promise) {
        if (running) {
            promise.reject("busy", "已有下载任务在进行")
            return
        }
        running = true
        received = 0L
        total = -1L
        done = false
        error = ""
        val safeName = fileName.replace("/", "_").replace(":", "_")
        Thread {
            var conn: HttpURLConnection? = null
            try {
                val target = File(updateDir(), safeName)
                if (target.exists()) {
                    target.delete()
                }
                var current = url
                var hops = 0
                while (hops < 8) {
                    conn = (URL(current).openConnection() as HttpURLConnection).apply {
                        instanceFollowRedirects = false
                        connectTimeout = 20000
                        readTimeout = 40000
                        setRequestProperty("User-Agent", "MusicFreeTV-Updater")
                    }
                    val code = conn.responseCode
                    if (code in 300..399) {
                        val location = conn.getHeaderField("Location")
                        conn.disconnect()
                        if (location.isNullOrEmpty()) {
                            throw RuntimeException("重定向缺少地址")
                        }
                        current = if (location.startsWith("http")) {
                            location
                        } else {
                            URL(URL(current), location).toString()
                        }
                        hops += 1
                        continue
                    }
                    if (code != 200) {
                        throw RuntimeException("HTTP $code")
                    }
                    break
                }
                val opened = conn ?: throw RuntimeException("连接失败")
                total = opened.contentLengthLong
                opened.inputStream.use { input ->
                    target.outputStream().use { out ->
                        val buf = ByteArray(16 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n <= 0) {
                                break
                            }
                            out.write(buf, 0, n)
                            received += n.toLong()
                        }
                    }
                }
                opened.disconnect()
                done = true
                promise.resolve(target.absolutePath)
            } catch (e: Throwable) {
                error = e.message ?: "下载失败"
                try {
                    conn?.disconnect()
                } catch (_: Throwable) {
                }
                promise.reject("download_failed", error)
            } finally {
                running = false
            }
        }.start()
    }

    @ReactMethod
    fun getProgress(promise: Promise) {
        val map = Arguments.createMap()
        map.putDouble("received", received.toDouble())
        map.putDouble("total", total.toDouble())
        map.putBoolean("done", done)
        map.putBoolean("busy", running)
        map.putString("error", error)
        promise.resolve(map)
    }

    /** 安卓 8 以后装 APK 需要"允许安装未知应用"，没开就引导一次 */
    @ReactMethod
    fun canInstall(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            promise.resolve(ctx.packageManager.canRequestPackageInstalls())
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun openInstallPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                intent.data = Uri.parse("package:" + ctx.packageName)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.reject("perm_failed", e.message ?: "无法打开授权页面")
        }
    }

    @ReactMethod
    fun install(path: String, promise: Promise) {
        try {
            val file = File(path)
            if (!file.exists()) {
                promise.reject("no_file", "安装包不存在")
                return
            }
            val uri = FileProvider.getUriForFile(
                ctx,
                ctx.packageName + ".tvupdater",
                file,
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            ctx.startActivity(intent)
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.reject("install_failed", e.message ?: "无法调起安装器")
        }
    }
}
