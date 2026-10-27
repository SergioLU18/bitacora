import UIKit
import Capacitor

/// Controlador raíz (lo crea `SceneDelegate`). Registra los plugins propios de la app, que no
/// vienen de npm y por eso Capacitor no los descubre solo.
class BitacoraViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetPlugin())
    }
}
