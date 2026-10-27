import Foundation
import Capacitor
import WidgetKit

/// Identificador del App Group que comparten la app y el widget. Debe coincidir con los
/// archivos `.entitlements` de ambos targets.
enum AppGroup {
    static let id = "group.com.sergiolopez.bitacora"
    static let archivoResumen = "resumen.json"

    /// Ruta del JSON con el `ResumenPendientes` que genera la web (`src/domain/resumen.ts`).
    static var urlResumen: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: id)?
            .appendingPathComponent(archivoResumen)
    }
}

/// Puente `Widget` que usa `src/lib/widget.ts`: recibe el resumen ya serializado, lo deja en el
/// App Group y pide a WidgetKit que redibuje el widget.
@objc(WidgetPlugin)
public class WidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetPlugin"
    public let jsName = "Widget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "guardarResumen", returnType: CAPPluginReturnPromise),
    ]

    @objc func guardarResumen(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), let datos = json.data(using: .utf8) else {
            call.reject("Falta `json`")
            return
        }
        guard let destino = AppGroup.urlResumen else {
            call.reject("App Group no disponible: revisa los entitlements (\(AppGroup.id))")
            return
        }
        do {
            try datos.write(to: destino, options: .atomic)
        } catch {
            call.reject("No se pudo escribir el resumen", nil, error)
            return
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
