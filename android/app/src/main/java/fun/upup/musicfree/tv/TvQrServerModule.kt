package `fun`.upup.musicfree.tv

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * 电视端「手机扫码输入」服务。
 *
 * 电视上用遥控器输入文字非常痛苦，这里在盒子上起一个极简的局域网 HTTP 服务：
 * 电视显示二维码 → 手机扫码打开网页 → 手机上打字/选文件 → 通过局域网回传给 App。
 *
 * 两种用途：
 * 1) /t 页面：输入歌名 / 歌手，直接填进搜索框；
 * 2) /p 页面：上传本地 .js 音源插件，或填写插件链接，直接安装。
 */
class TvQrServerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var serverSocket: ServerSocket? = null
    private var serverThread: Thread? = null
    private var running = false
    private var port = 0
    private val token: String = UUID.randomUUID().toString().replace("-", "").substring(0, 10)
    private val pendingTexts = ConcurrentLinkedQueue<String>()
    private val pendingPluginFiles = ConcurrentLinkedQueue<String>()
    private val pendingPluginUrls = ConcurrentLinkedQueue<String>()

    override fun getName() = "TvQrServer"

    private fun lanAddress(): String {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val nif = interfaces.nextElement()
                if (!nif.isUp || nif.isLoopback) {
                    continue
                }
                val addresses = nif.inetAddresses
                while (addresses.hasMoreElements()) {
                    val address = addresses.nextElement()
                    if (address is Inet4Address && !address.isLoopbackAddress && address.isSiteLocalAddress) {
                        return address.hostAddress ?: "127.0.0.1"
                    }
                }
            }
        } catch (_: Throwable) {
            // ignore
        }
        return "127.0.0.1"
    }

    private fun infoMap() = Arguments.createMap().apply {
        val ip = lanAddress()
        putString("ip", ip)
        putInt("port", port)
        putString("token", token)
        putString("textUrl", "http://" + ip + ":" + port + "/t?k=" + token)
        putString("pluginUrl", "http://" + ip + ":" + port + "/p?k=" + token)
        putString("linkUrl", "http://" + ip + ":" + port + "/t?k=" + token + "&m=link")
    }

    @ReactMethod
    fun start(promise: Promise) {
        try {
            if (!running) {
                val socket = ServerSocket(0)
                socket.reuseAddress = true
                serverSocket = socket
                port = socket.localPort
                running = true
                serverThread = Thread {
                    while (running) {
                        try {
                            val client = socket.accept()
                            Thread { handleClient(client) }.apply {
                                isDaemon = true
                                start()
                            }
                        } catch (_: Throwable) {
                            break
                        }
                    }
                }.apply {
                    isDaemon = true
                    start()
                }
            }
            promise.resolve(infoMap())
        } catch (e: Throwable) {
            promise.reject("qr_start_failed", e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            running = false
            serverSocket?.close()
            serverSocket = null
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getInfo(promise: Promise) {
        promise.resolve(infoMap())
    }

    @ReactMethod
    fun pollText(promise: Promise) {
        promise.resolve(pendingTexts.poll())
    }

    @ReactMethod
    fun pollPlugin(promise: Promise) {
        val file = pendingPluginFiles.poll()
        val url = pendingPluginUrls.poll()
        if (file == null && url == null) {
            promise.resolve(null)
            return
        }
        val map = Arguments.createMap()
        if (file != null) {
            map.putString("type", "file")
            map.putString("value", file)
        } else {
            map.putString("type", "url")
            map.putString("value", url)
        }
        promise.resolve(map)
    }

    // ---------- HTTP ----------

    private fun readLine(input: InputStream): String? {
        val builder = StringBuilder()
        var read: Int
        while (true) {
            read = input.read()
            if (read == -1) {
                return if (builder.isEmpty()) null else builder.toString()
            }
            if (read == '\n'.code) {
                return builder.toString().trimEnd('\r')
            }
            builder.append(read.toChar())
        }
    }

    private fun readBody(input: InputStream, length: Int): ByteArray {
        val out = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        var remaining = length
        while (remaining > 0) {
            val read = input.read(buffer, 0, minOf(buffer.size, remaining))
            if (read <= 0) {
                break
            }
            out.write(buffer, 0, read)
            remaining -= read
        }
        return out.toByteArray()
    }

    private fun writeResponse(socket: Socket, status: String, contentType: String, body: ByteArray) {
        try {
            val output: OutputStream = socket.getOutputStream()
            val header = ("HTTP/1.1 " + status + "\r\n" +
                "Content-Type: " + contentType + "\r\n" +
                "Content-Length: " + body.size + "\r\n" +
                "Cache-Control: no-store\r\n" +
                "Connection: close\r\n\r\n")
            output.write(header.toByteArray())
            output.write(body)
            output.flush()
        } catch (_: Throwable) {
            // ignore
        }
    }

    private fun jsonOk(message: String): ByteArray {
        val escaped = message.replace("\\", "\\\\").replace("\"", "\\\"")
        return ("{\"ok\":true,\"message\":\"" + escaped + "\"}").toByteArray()
    }

    private fun handleClient(socket: Socket) {
        try {
            socket.use { client ->
                client.soTimeout = 5000
                val input = BufferedInputStream(client.getInputStream())
                val requestLine = readLine(input) ?: return
                val parts = requestLine.split(" ")
                if (parts.size < 2) {
                    return
                }
                val method = parts[0]
                val fullPath = parts[1]
                val headers = HashMap<String, String>()
                while (true) {
                    val line = readLine(input) ?: break
                    if (line.isEmpty()) {
                        break
                    }
                    val idx = line.indexOf(':')
                    if (idx > 0) {
                        headers[line.substring(0, idx).trim().lowercase()] =
                            line.substring(idx + 1).trim()
                    }
                }
                val queryIndex = fullPath.indexOf('?')
                val path = if (queryIndex >= 0) fullPath.substring(0, queryIndex) else fullPath
                val query = HashMap<String, String>()
                if (queryIndex >= 0) {
                    fullPath.substring(queryIndex + 1).split('&').forEach { pair ->
                        val eq = pair.indexOf('=')
                        if (eq > 0) {
                            query[pair.substring(0, eq)] =
                                URLDecoder.decode(pair.substring(eq + 1), "UTF-8")
                        }
                    }
                }
                if (query["k"] != token) {
                    writeResponse(client, "403 Forbidden", "text/plain; charset=utf-8", "token 无效，请重新扫码".toByteArray())
                    return
                }
                val contentLength = headers["content-length"]?.toIntOrNull() ?: 0
                val bodyBytes =
                    if (method == "POST" && contentLength > 0) readBody(input, contentLength) else ByteArray(0)

                when {
                    method == "GET" && (path == "/t" || path == "/") -> {
                    val isLink = fullPath.contains("m=link")
                        writeResponse(client, "200 OK", "text/html; charset=utf-8", textPage(isLink).toByteArray())
                    }
                    method == "GET" && path == "/p" -> {
                        writeResponse(client, "200 OK", "text/html; charset=utf-8", pluginPage().toByteArray())
                    }
                    method == "POST" && path == "/text" -> {
                        val text = URLDecoder.decode(bodyBytes.toString(Charsets.UTF_8), "UTF-8")
                            .removePrefix("t=")
                            .trim()
                        if (text.isNotEmpty()) {
                            pendingTexts.add(text)
                        }
                        writeResponse(client, "200 OK", "application/json; charset=utf-8", jsonOk("已发送到电视"))
                    }
                    method == "POST" && path == "/url" -> {
                        val url = URLDecoder.decode(bodyBytes.toString(Charsets.UTF_8), "UTF-8")
                            .removePrefix("u=")
                            .trim()
                        if (url.isNotEmpty()) {
                            pendingPluginUrls.add(url)
                        }
                        writeResponse(client, "200 OK", "application/json; charset=utf-8", jsonOk("链接已发送到电视"))
                    }
                    method == "POST" && path == "/upload" -> {
                        val rawName = query["name"] ?: "plugin.js"
                        val safeName = rawName.replace(Regex("[^0-9A-Za-z._-]"), "_")
                        val dir = File(reactContext.filesDir, "qr_plugin")
                        if (!dir.exists()) {
                            dir.mkdirs()
                        }
                        val file = File(dir, System.currentTimeMillis().toString() + "_" + safeName)
                        file.writeBytes(bodyBytes)
                        pendingPluginFiles.add(file.absolutePath)
                        writeResponse(client, "200 OK", "application/json; charset=utf-8", jsonOk("插件已上传到电视"))
                    }
                    else -> writeResponse(client, "404 Not Found", "text/plain; charset=utf-8", "not found".toByteArray())
                }
            }
        } catch (_: Throwable) {
            // 单个请求失败不影响服务
        }
    }

    // ---------- 手机端页面 ----------

    private fun pageShell(title: String, body: String): String {
        return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">" +
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
            "<title>" + title + "</title><style>" +
            "body{font-family:-apple-system,sans-serif;background:#11151c;color:#e8ecf2;margin:0;padding:24px}" +
            "h1{font-size:20px;margin:0 0 8px}p{color:#9aa7b8;font-size:14px;line-height:1.6}" +
            "textarea,input{width:100%;box-sizing:border-box;font-size:18px;padding:14px;border-radius:12px;" +
            "border:1px solid #2c3648;background:#1b2230;color:#fff;margin:12px 0}" +
            "textarea{height:96px}button{width:100%;font-size:18px;padding:16px;border:0;border-radius:12px;" +
            "background:#2f7cf6;color:#fff;font-weight:600}button:active{opacity:.8}" +
            ".ok{color:#54d18b;font-size:15px;margin-top:12px;min-height:22px}" +
            ".hint{font-size:13px;color:#77839a;margin-top:18px}" +
            "input[type=file]{padding:12px;background:#1b2230}" +
            "</style></head><body>" + body + "</body></html>"
    }

    private fun textPage(isLink: Boolean = false): String {
        val title = if (isLink) "输入链接到电视" else "发送文字到电视"
        val desc = if (isLink) "在手机上粘贴链接（歌单/单曲/插件地址），点发送后会直接填到电视的输入框。" else "在手机上输入歌名或歌手，点发送后会直接出现在电视的搜索框里。"
        val ph = if (isLink) "https://..." else "例如：周杰伦 稻香"
        val form = "<h1>" + title + "</h1>" +
            "<p>" + desc + "</p>" +
            "<textarea id=\"t\" placeholder=\"" + ph + "\"></textarea>" +
            "<button id=\"send\">发送到电视</button>" +
            "<div class=\"ok\" id=\"msg\"></div>" +
            "<div class=\"hint\">电视与手机需在同一 Wi-Fi 下。发送后电视会自动开始搜索。</div>"
        val script = "<script>" +
            "var btn=document.getElementById('send');var msg=document.getElementById('msg');" +
            "var area=document.getElementById('t');" +
            "btn.onclick=function(){var v=area.value.trim();if(!v){msg.textContent='请输入内容';return;}" +
            "btn.disabled=true;msg.textContent='发送中…';" +
            "fetch('/text?k=" + token + "',{method:'POST',body:'t='+encodeURIComponent(v)})" +
            ".then(function(r){return r.json();}).then(function(j){msg.textContent=j.message||'已发送';" +
            "area.value='';btn.disabled=false;}).catch(function(){msg.textContent='发送失败，请重试';btn.disabled=false;});};" +
            "</script>"
        return pageShell(title, form + script)
    }

    private fun pluginPage(): String {
        val form = "<h1>导入音源插件</h1>" +
            "<p>可以上传手机里的 <b>.js</b> 音源插件，或直接填写插件/订阅链接。</p>" +
            "<input type=\"file\" id=\"f\" accept=\".js,text/javascript,application/javascript\">" +
            "<button id=\"up\">上传并安装</button>" +
            "<p style=\"margin-top:24px\">或填写插件链接（支持 http/https 与 raw 链接）：</p>" +
            "<input type=\"url\" id=\"u\" placeholder=\"https://example.com/plugin.js\">" +
            "<button id=\"sub\">发送链接到电视</button>" +
            "<div class=\"ok\" id=\"msg\"></div>" +
            "<div class=\"hint\">上传后电视会自动安装该插件，无需在电视上操作。</div>"
        val script = "<script>" +
            "var msg=document.getElementById('msg');" +
            "document.getElementById('up').onclick=function(){var f=document.getElementById('f').files[0];" +
            "if(!f){msg.textContent='请先选择 .js 插件文件';return;}msg.textContent='上传中…';" +
            "var xhr=new XMLHttpRequest();xhr.open('POST','/upload?k=" + token + "&name='+encodeURIComponent(f.name));" +
            "xhr.onload=function(){try{var j=JSON.parse(xhr.responseText);msg.textContent=j.message||'已上传';}" +
            "catch(e){msg.textContent='已上传';}};" +
            "xhr.onerror=function(){msg.textContent='上传失败，请重试';};xhr.send(f);};" +
            "document.getElementById('sub').onclick=function(){var v=document.getElementById('u').value.trim();" +
            "if(!v){msg.textContent='请输入链接';return;}msg.textContent='发送中…';" +
            "fetch('/url?k=" + token + "',{method:'POST',body:'u='+encodeURIComponent(v)})" +
            ".then(function(r){return r.json();}).then(function(j){msg.textContent=j.message||'已发送';" +
            "document.getElementById('u').value='';}).catch(function(){msg.textContent='发送失败，请重试';});};" +
            "</script>"
        return pageShell("导入音源插件", form + script)
    }
}
