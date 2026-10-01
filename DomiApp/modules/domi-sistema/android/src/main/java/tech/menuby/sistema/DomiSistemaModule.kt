package tech.menuby.sistema

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Debug
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.InetSocketAddress
import java.net.Socket
import java.security.MessageDigest

/**
 * Lo que la app del domi necesita del sistema y Expo no trae:
 *  - abrirse sola encima de otras apps cuando cae un pedido;
 *  - encender la pantalla y mostrarse sobre el bloqueo mientras suena la oferta;
 *  - revisar que la app sea la oficial y que nadie la esté modificando en vivo.
 */
class DomiSistemaModule : Module() {
  private val contexto: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("DomiSistema")

    /* ── Pedidos como llamada entrante (ver Llamadas.kt) ── */

    /** Esta versión de la app trae la llamada nativa (el servidor solo la usa si es así). */
    Constant("llamadas") { true }

    Events("llamada")

    OnCreate {
      Llamadas.alLlegar = { datos ->
        sendEvent("llamada", mapOf("clave" to datos.getString("clave"), "tipo" to (datos.getString("tipo") ?: datos.getString("llamada"))))
      }
      Llamadas.crearCanales(contexto)
    }

    OnDestroy {
      Llamadas.alLlegar = null
    }

    /** Cuelga una llamada: la app ya muestra la oferta o ya no aplica. */
    Function("cancelarLlamada") { clave: String ->
      Llamadas.cancelar(contexto, clave)
    }

    Function("cancelarLlamadas") {
      Llamadas.cancelarTodas(contexto)
    }

    /** ¿El domi está viendo la app? (actividad al frente y pantalla prendida, aunque sea sobre el bloqueo) */
    Function("appALaVista") {
      Llamadas.actividadVisible && (contexto.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager).isInteractive
    }

    /** El timbre de la app (pantalla de oferta): alarma al 100 %, aunque esté en silencio. */
    Function("timbrar") { clave: String, sonido: Boolean, vibrar: Boolean ->
      Timbre.sonar(contexto, clave, 0, sonido, vibrar)
    }

    Function("soltarTimbre") { clave: String ->
      Timbre.soltar(contexto, clave)
    }

    /** La llamada con la que se abrió la app (una sola vez). */
    Function("llamadaPendiente") {
      val p = Llamadas.pendiente ?: return@Function null
      Llamadas.pendiente = null
      mapOf("clave" to p.getString("clave"), "tipo" to p.getString("tipo"))
    }

    /** Android 14+: "Notificaciones en pantalla completa" (sin él la llamada no se abre sola con el celular bloqueado). */
    Function("puedePantallaCompleta") {
      Llamadas.puedePantallaCompleta(contexto)
    }

    Function("abrirPermisoPantallaCompleta") {
      Llamadas.abrirPermisoPantallaCompleta(contexto)
    }

    /** ¿Tiene el permiso "Mostrar sobre otras apps"? Sin él Android no deja abrirse desde atrás. */
    Function("puedeSuperponer") {
      Settings.canDrawOverlays(contexto)
    }

    Function("abrirPermisoSuperponer") {
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${contexto.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      contexto.startActivity(intent)
    }

    /**
     * Xiaomi (MIUI/HyperOS) tiene permisos propios encima de los de Android:
     * "Mostrar ventanas emergentes en segundo plano" (10021) y "Mostrar en
     * pantalla de bloqueo" (10020). Apagados, la oferta suena pero la app no
     * se abre. En otras marcas responde que todo está bien.
     */
    Function("permisosXiaomi") {
      if (!esXiaomi()) return@Function mapOf("aplica" to false, "segundoPlano" to true, "bloqueo" to true)
      mapOf("aplica" to true, "segundoPlano" to opMiuiPermitida(10021), "bloqueo" to opMiuiPermitida(10020))
    }

    /** La pantalla de permisos de Xiaomi para esta app ("Otros permisos"). */
    Function("abrirPermisosXiaomi") {
      val paquete = contexto.packageName
      val intentos = listOf(
        Intent("miui.intent.action.APP_PERM_EDITOR")
          .setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity")
          .putExtra("extra_pkgname", paquete),
        Intent("miui.intent.action.APP_PERM_EDITOR")
          .setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.AppPermissionsEditorActivity")
          .putExtra("extra_pkgname", paquete),
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$paquete"))
      )
      for (intent in intentos) {
        try {
          contexto.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          return@Function true
        } catch (e: Exception) { /* la siguiente */ }
      }
      false
    }

    /** Trae la app al frente aunque el domi esté en otra app (requiere el permiso de arriba). */
    Function("traerAlFrente") {
      val intent = contexto.packageManager.getLaunchIntentForPackage(contexto.packageName)
        ?: return@Function false
      intent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP
      )
      try {
        contexto.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    /** Mientras suena una oferta: pantalla encendida y la app encima del bloqueo. */
    AsyncFunction("mostrarSobreBloqueo") { activo: Boolean ->
      val actividad: Activity = appContext.currentActivity ?: return@AsyncFunction null
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        actividad.setShowWhenLocked(activo)
        actividad.setTurnScreenOn(activo)
      }
      null
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("integridad") {
      mapOf(
        "firmas" to firmas(),
        "depurable" to ((contexto.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0),
        "depuradorConectado" to Debug.isDebuggerConnected(),
        "instalador" to instalador(),
        "root" to tieneRoot(),
        "emulador" to esEmulador(),
        "ganchos" to ganchos()
      )
    }
  }

  private fun esXiaomi(): Boolean {
    val m = Build.MANUFACTURER.lowercase()
    return m.contains("xiaomi") || m.contains("redmi") || m.contains("poco")
  }

  /** ¿MIUI permite esta operación suya? (no está en el SDK: se pregunta por reflexión). */
  private fun opMiuiPermitida(op: Int): Boolean = try {
    val ops = contexto.getSystemService(Context.APP_OPS_SERVICE) as android.app.AppOpsManager
    val metodo = ops.javaClass.getMethod("checkOpNoThrow", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType, String::class.java)
    val modo = metodo.invoke(ops, op, android.os.Process.myUid(), contexto.packageName) as Int
    modo == android.app.AppOpsManager.MODE_ALLOWED
  } catch (e: Exception) {
    true // si no se puede saber, no se le pide nada al domi
  }

  /** Huellas SHA-256 de la llave con que se firmó ESTA copia de la app. */
  private fun firmas(): List<String> {
    val pm = contexto.packageManager
    val nombre = contexto.packageName
    val certificados = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val info = pm.getPackageInfo(nombre, PackageManager.GET_SIGNING_CERTIFICATES).signingInfo ?: return emptyList()
      if (info.hasMultipleSigners()) info.apkContentsSigners else info.signingCertificateHistory
    } else {
      @Suppress("DEPRECATION")
      pm.getPackageInfo(nombre, PackageManager.GET_SIGNATURES).signatures
    } ?: return emptyList()
    return certificados.map { firma ->
      MessageDigest.getInstance("SHA-256").digest(firma.toByteArray()).joinToString("") { "%02x".format(it) }
    }
  }

  private fun instalador(): String? = try {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      contexto.packageManager.getInstallSourceInfo(contexto.packageName).installingPackageName
    } else {
      @Suppress("DEPRECATION")
      contexto.packageManager.getInstallerPackageName(contexto.packageName)
    }
  } catch (e: Exception) {
    null
  }

  private fun tieneRoot(): Boolean {
    val rutas = listOf(
      "/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su", "/data/local/xbin/su",
      "/data/local/bin/su", "/system/sd/xbin/su", "/system/app/Superuser.apk", "/data/adb/magisk", "/data/adb/ksu"
    )
    return rutas.any { File(it).exists() } || (Build.TAGS?.contains("test-keys") == true)
  }

  private fun esEmulador(): Boolean {
    val f = Build.FINGERPRINT.lowercase()
    return f.startsWith("generic") || f.contains("emulator") || f.contains("sdk_gphone") ||
      Build.MODEL.contains("Emulator") || Build.MODEL.contains("Android SDK built for") ||
      Build.HARDWARE.contains("goldfish") || Build.HARDWARE.contains("ranchu") ||
      Build.PRODUCT.contains("sdk")
  }

  /** Herramientas que modifican la app mientras corre (para cambiar precios, GPS, etc.). */
  private fun ganchos(): List<String> {
    val hallados = mutableSetOf<String>()
    val mapa = try { File("/proc/self/maps").readText().lowercase() } catch (e: Exception) { "" }
    if (mapa.contains("frida") || mapa.contains("gum-js") || mapa.contains("linjector")) hallados.add("frida")
    if (mapa.contains("xposed") || mapa.contains("lspd") || mapa.contains("lsposed")) hallados.add("xposed")
    if (mapa.contains("lspatch")) hallados.add("lspatch")
    if (mapa.contains("substrate")) hallados.add("substrate")
    try {
      Class.forName("de.robv.android.xposed.XposedBridge")
      hallados.add("xposed")
    } catch (e: Throwable) { /* no está */ }
    // Hilos que deja Frida al inyectarse
    try {
      File("/proc/self/task").listFiles()?.forEach { hilo ->
        val nombre = try { File(hilo, "comm").readText().trim() } catch (e: Exception) { "" }
        if (nombre == "gum-js-loop" || nombre.startsWith("frida")) hallados.add("frida")
      }
    } catch (e: Exception) { /* sin acceso */ }
    // El servidor de Frida escuchando en su puerto de siempre
    try {
      Socket().use { s ->
        s.connect(InetSocketAddress("127.0.0.1", 27042), 150)
        hallados.add("frida")
      }
    } catch (e: Exception) { /* cerrado: bien */ }
    return hallados.toList()
  }
}
