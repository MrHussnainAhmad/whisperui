package com.whisper.privacy

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.toCodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer

private const val SAVE_CODE = 53127
private const val MAX_BYTES = 3_000_000

class WhisperAttachmentsModule : Module() {
  private var savePromise: Promise? = null
  @Volatile private var exportUri: Uri? = null
  private val context get() = requireNotNull(appContext.reactContext)
  private fun decode(value: String): ByteArray {
    require(value.length <= 4_000_256) { "Attachment too large" }
    return Base64.decode(value, Base64.DEFAULT).also { require(it.size <= MAX_BYTES + 192) }
  }
  private fun temporary(): File = File.createTempFile("whisper-private-", ".tmp", context.cacheDir)

  override fun definition() = ModuleDefinition {
    Name("WhisperAttachments")
    AsyncFunction("cleanTemporaryFiles") {
      context.cacheDir.listFiles()?.filter { it.name.startsWith("whisper-private-") }?.forEach { it.delete() }
    }

    AsyncFunction("chooseSaveFile") { name: String, mime: String, promise: Promise ->
      check(savePromise == null && exportUri == null) { "Export already in progress" }
      require(name.matches(Regex("[A-Za-z0-9._-]{1,100}")))
      require(mime.matches(Regex("[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+")))
      savePromise = promise
      try {
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = mime
          putExtra(Intent.EXTRA_TITLE, name)
        }
        appContext.throwingActivity.startActivityForResult(intent, SAVE_CODE)
      } catch (error: Exception) {
        savePromise = null
        promise.reject(error.toCodedException())
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, (requestCode, resultCode, intent) ->
      if (requestCode == SAVE_CODE) {
        val promise = savePromise
        savePromise = null
        val uri = if (resultCode == Activity.RESULT_OK) intent?.data else null
        if (promise != null) {
          exportUri = uri
          promise.resolve(uri?.toString())
        }
      }
    }

    AsyncFunction("writeChosenFile") { uriString: String, base64: String ->
      val uri = requireNotNull(exportUri)
      check(uri.toString() == uriString) { "Export destination expired" }
      val bytes = decode(base64)
      try {
        requireNotNull(context.contentResolver.openOutputStream(uri, "wt")).use { stream ->
          var offset = 0
          while (offset < bytes.size) {
            val count = minOf(65536, bytes.size - offset)
            stream.write(bytes, offset, count)
            offset += count
          }
          stream.flush()
        }
        true
      } finally { bytes.fill(0) }
    }

    AsyncFunction("copyChosenFile") { uriString: String, sourceUri: String ->
      val uri = requireNotNull(exportUri)
      check(uri.toString() == uriString)
      val source = File(requireNotNull(Uri.parse(sourceUri).path)).canonicalFile
      require(source.path.startsWith(context.cacheDir.canonicalPath + File.separator))
      source.inputStream().use { input ->
        requireNotNull(context.contentResolver.openOutputStream(uri, "wt")).use { output ->
          input.copyTo(output, 98304)
          output.flush()
        }
      }
      true
    }

    AsyncFunction("finishExport") { keep: Boolean ->
      val uri = exportUri
      exportUri = null
      if (!keep && uri != null) DocumentsContract.deleteDocument(context.contentResolver, uri)
    }

    AsyncFunction("renderPdfPage") { base64: String, index: Int ->
      val bytes = decode(base64)
      val file = temporary()
      try {
        file.writeBytes(bytes)
        bytes.fill(0)
        val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
        // The renderer owns this descriptor. Unlink immediately; no cached PDF.
        file.delete()
        descriptor.use { ownedDescriptor -> PdfRenderer(ownedDescriptor).use { renderer ->
          require(renderer.pageCount in 1..100 && index in 0 until renderer.pageCount)
          renderer.openPage(index).use { page ->
            val scale = 1200.0 / maxOf(page.width, page.height)
            val bitmap = Bitmap.createBitmap(maxOf(1, (page.width * scale).toInt()),
              maxOf(1, (page.height * scale).toInt()), Bitmap.Config.ARGB_8888)
            try {
              bitmap.eraseColor(Color.WHITE)
              page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              val output = ByteArrayOutputStream()
              bitmap.compress(Bitmap.CompressFormat.JPEG, 85, output)
              mapOf("pageCount" to renderer.pageCount, "image" to Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP))
            } finally { bitmap.recycle() }
          }
        } }
      } finally { bytes.fill(0); file.delete() }
    }

    AsyncFunction("cleanVideoFile") { inputUri: String ->
      // Only picker-owned local files; never fetch remote URLs.
      val uri = Uri.parse(inputUri)
      require(uri.scheme == "file" || uri.scheme == "content")
      val extractor = MediaExtractor()
      val output = temporary()
      var muxer: MediaMuxer? = null
      var started = false
      var retained = false
      try {
        extractor.setDataSource(context, uri, null)
        val writer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        muxer = writer
        val tracks = mutableMapOf<Int, Int>()
        val kinds = mutableSetOf<String>()
        for (index in 0 until extractor.trackCount) {
          val source = extractor.getTrackFormat(index)
          val mime = source.getString(MediaFormat.KEY_MIME) ?: continue
          if (!mime.startsWith("video/") && !mime.startsWith("audio/")) continue
          require(kinds.add(mime.substringBefore('/'))) { "Multiple tracks of the same type unsupported" }
          require(tracks.size < 2) { "Only one video and one audio track supported" }
          val clean = MediaFormat()
          clean.setString(MediaFormat.KEY_MIME, mime)
          for (key in listOf("width", "height", "sample-rate", "channel-count", "aac-profile", "color-standard", "color-transfer", "color-range")) {
            if (source.containsKey(key)) clean.setInteger(key, source.getInteger(key))
          }
          for (key in listOf("csd-0", "csd-1", "csd-2")) {
            if (source.containsKey(key)) source.getByteBuffer(key)?.let { clean.setByteBuffer(key, it) }
          }
          if (mime.startsWith("video/") && source.containsKey("rotation-degrees")) {
            writer.setOrientationHint(source.getInteger("rotation-degrees"))
          }
          tracks[index] = writer.addTrack(clean)
          extractor.selectTrack(index)
        }
        require(tracks.isNotEmpty()) { "No supported media tracks" }
        writer.start(); started = true
        var buffer = ByteBuffer.allocateDirect(1024 * 1024)
        val info = MediaCodec.BufferInfo()
        while (extractor.sampleTrackIndex >= 0) {
          val needed = extractor.sampleSize
          require(needed in 0L..32_000_000L) { "Unsupported encoded frame size" }
          if (needed > buffer.capacity()) buffer = ByteBuffer.allocateDirect(needed.toInt())
          val track = requireNotNull(tracks[extractor.sampleTrackIndex])
          buffer.clear()
          val size = extractor.readSampleData(buffer, 0)
          if (size < 0) break
          require(extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_ENCRYPTED == 0) { "Encrypted media unsupported" }
          val flags = if (extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
          info.set(0, size, extractor.sampleTime, flags)
          writer.writeSampleData(track, buffer, info)
          extractor.advance()
        }
        writer.stop(); started = false
        writer.release(); muxer = null
        retained = true
        Uri.fromFile(output).toString()
      } finally {
        if (started) runCatching { muxer?.stop() }
        runCatching { muxer?.release() }
        extractor.release()
        if (!retained) output.delete()
      }
    }
  }
}
