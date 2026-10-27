import SwiftUI
import WidgetKit

// MARK: - Línea de tiempo

struct Entrada: TimelineEntry {
    let date: Date
    let estado: AlmacenResumen.Estado
}

struct Proveedor: TimelineProvider {
    func placeholder(in context: Context) -> Entrada {
        Entrada(date: Date(), estado: .listo(Pendientes.ejemplo))
    }

    func getSnapshot(in context: Context, completion: @escaping (Entrada) -> Void) {
        if context.isPreview {
            completion(Entrada(date: Date(), estado: .listo(Pendientes.ejemplo)))
        } else {
            completion(Entrada(date: Date(), estado: AlmacenResumen.cargar()))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entrada>) -> Void) {
        let ahora = Date()
        var entradas = [Entrada(date: ahora, estado: AlmacenResumen.cargar(ahora: ahora))]
        if case .listo(let pendientes) = entradas[0].estado {
            // Una entrada por cada momento en que algo pasa a "vencida" y otra a medianoche,
            // reclasificando contra ese instante. Después, WidgetKit vuelve a pedir la línea.
            for momento in pendientes.momentosDeCambio(desde: ahora) {
                entradas.append(Entrada(date: momento, estado: AlmacenResumen.cargar(ahora: momento)))
            }
        }
        completion(Timeline(entries: entradas, policy: .atEnd))
    }
}

// MARK: - Widget

@main
struct BitacoraWidget: Widget {
    let kind = "BitacoraPendientes"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Proveedor()) { entrada in
            VistaWidget(entrada: entrada)
                .fondoWidget()
        }
        .configurationDisplayName(Textos.actual.nombreWidget)
        .description(Textos.actual.descripcionWidget)
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Vistas

struct VistaWidget: View {
    let entrada: Entrada
    @Environment(\.widgetFamily) private var familia

    private var textos: Textos { Textos.actual }

    var body: some View {
        switch entrada.estado {
        case .sinDatos:
            VistaMensaje(icono: "arrow.up.forward.app", titulo: textos.abreLaApp, detalle: familia == .systemSmall ? nil : textos.abreLaAppDetalle)
                .widgetURL(Enlaces.vista("hoy"))
        case .listo(let pendientes):
            if familia == .systemSmall {
                VistaPequena(pendientes: pendientes, ahora: entrada.date)
                    .widgetURL(Enlaces.vista("hoy"))
            } else if pendientes.estaVacio {
                VistaMensaje(icono: "checkmark.circle", titulo: textos.nadaPendiente, detalle: textos.nadaPendienteDetalle)
                    .widgetURL(Enlaces.vista("hoy"))
            } else {
                VistaLista(pendientes: pendientes, ahora: entrada.date, filas: familia == .systemLarge ? 9 : 3)
            }
        }
    }
}

/// Pequeño: solo los conteos, grandes y legibles. Los cuatro caben en una rejilla de dos columnas.
struct VistaPequena: View {
    let pendientes: Pendientes
    let ahora: Date
    private var textos: Textos { Textos.actual }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Encabezado(ahora: ahora)
            Spacer(minLength: 0)
            if pendientes.estaVacio {
                Label(textos.nadaPendiente, systemImage: "checkmark.circle")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.secondary)
            } else {
                HStack(alignment: .top, spacing: 8) {
                    Contador(valor: pendientes.vencidas.total, etiqueta: textos.vencidas, color: .red)
                    Contador(valor: pendientes.hoy.total, etiqueta: textos.hoy, color: .primary)
                }
                HStack(alignment: .top, spacing: 8) {
                    Contador(valor: pendientes.proximas.total, etiqueta: textos.proximas, color: .secondary)
                    Contador(valor: pendientes.seguimiento.total, etiqueta: textos.seguimiento, color: .marca)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// Mediano y grande: encabezado con conteos y las tareas más urgentes, cada una con enlace.
struct VistaLista: View {
    let pendientes: Pendientes
    let ahora: Date
    let filas: Int
    private var textos: Textos { Textos.actual }

    private struct Fila: Identifiable {
        enum Tipo { case titulo(String, Color), tarea(TareaResumida, Clase) }
        let id: String
        let tipo: Tipo
    }

    enum Clase { case vencida, hoy, proxima, seguimiento }

    /// Reparte el presupuesto de filas: primero vencidas, luego hoy, próximas y lo del cliente. Los
    /// títulos de sección solo aparecen en el widget grande; en el mediano el color de la fecha ya lo dice.
    private var filasVisibles: (filas: [Fila], ocultas: Int) {
        var resultado: [Fila] = []
        var disponibles = filas
        let conTitulos = filas > 4
        let secciones: [(Pendientes.Seccion, Clase, String, Color)] = [
            (pendientes.vencidas, .vencida, textos.vencidas, .red),
            (pendientes.hoy, .hoy, textos.hoy, .primary),
            (pendientes.proximas, .proxima, textos.proximas, .secondary),
            (pendientes.seguimiento, .seguimiento, textos.seguimiento, .marca),
        ]
        for (seccion, clase, titulo, color) in secciones where !seccion.tareas.isEmpty && disponibles > 0 {
            if conTitulos {
                resultado.append(Fila(id: "titulo-\(titulo)", tipo: .titulo(titulo, color)))
            }
            for tarea in seccion.tareas.prefix(disponibles) {
                resultado.append(Fila(id: tarea.id, tipo: .tarea(tarea, clase)))
                disponibles -= 1
            }
        }
        let mostradas = resultado.reduce(0) { total, fila in
            if case .tarea = fila.tipo { return total + 1 }
            return total
        }
        return (resultado, max(0, pendientes.totalListado - mostradas))
    }

    var body: some View {
        let (visibles, ocultas) = filasVisibles
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Encabezado(ahora: ahora)
                Spacer()
                Conteos(pendientes: pendientes)
            }
            .padding(.bottom, 8)

            ForEach(visibles) { fila in
                switch fila.tipo {
                case .titulo(let titulo, let color):
                    Text(titulo.uppercased())
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(color)
                        .padding(.top, 6)
                        .padding(.bottom, 2)
                case .tarea(let tarea, let clase):
                    Link(destination: Enlaces.tarea(tarea.id)) {
                        FilaTarea(tarea: tarea, clase: clase, ahora: ahora)
                    }
                }
            }

            if ocultas > 0 {
                Text(textos.masPendientes(ocultas))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(Enlaces.vista("hoy"))
    }
}

struct FilaTarea: View {
    let tarea: TareaResumida
    let clase: VistaLista.Clase
    let ahora: Date

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(tarea.proyecto.map { Color(hex: $0.color) } ?? Color.secondary.opacity(0.4))
                .frame(width: 8, height: 8)
            Text(tarea.titulo)
                .font(.footnote)
                .lineLimit(1)
                .foregroundStyle(.primary)
            Spacer(minLength: 4)
            Text(FormatoFecha.etiqueta(tarea, clase: clase, ahora: ahora))
                .font(.caption2.monospacedDigit())
                .foregroundStyle(FormatoFecha.color(tarea, clase: clase, ahora: ahora))
                .lineLimit(1)
        }
        .padding(.vertical, 3)
    }
}

struct Encabezado: View {
    let ahora: Date

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "book.closed.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.marca)
            Text(FormatoFecha.diaCorto(ahora))
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}

struct Conteos: View {
    let pendientes: Pendientes

    var body: some View {
        HStack(spacing: 10) {
            if pendientes.vencidas.total > 0 {
                Chip(valor: pendientes.vencidas.total, icono: "exclamationmark.circle.fill", color: .red)
            }
            Chip(valor: pendientes.hoy.total, icono: "sun.max.fill", color: .primary)
            Chip(valor: pendientes.proximas.total, icono: "calendar", color: .secondary)
            if pendientes.seguimiento.total > 0 {
                Chip(valor: pendientes.seguimiento.total, icono: "hourglass", color: .marca)
            }
        }
    }

    private struct Chip: View {
        let valor: Int
        let icono: String
        let color: Color
        var body: some View {
            HStack(spacing: 3) {
                Image(systemName: icono).font(.caption2)
                Text("\(valor)").font(.caption.weight(.semibold).monospacedDigit())
            }
            .foregroundStyle(color)
        }
    }
}

struct Contador: View {
    let valor: Int
    let etiqueta: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("\(valor)")
                .font(.title3.weight(.bold).monospacedDigit())
                .foregroundStyle(valor == 0 ? Color.secondary : color)
            Text(etiqueta)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct VistaMensaje: View {
    let icono: String
    let titulo: String
    let detalle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Encabezado(ahora: Date())
            Spacer(minLength: 0)
            Image(systemName: icono)
                .font(.title2)
                .foregroundStyle(.secondary)
            Text(titulo).font(.subheadline.weight(.semibold))
            if let detalle {
                Text(detalle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Utilidades

enum Enlaces {
    static let esquema = "bitacora"
    static func vista(_ nombre: String) -> URL { URL(string: "\(esquema)://\(nombre)")! }
    static func tarea(_ id: String) -> URL {
        let seguro = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        return URL(string: "\(esquema)://tarea/\(seguro)") ?? vista("hoy")
    }
}

enum FormatoFecha {
    private static let hora: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.setLocalizedDateFormatFromTemplate("jm")
        return f
    }()
    private static let diaSemana: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.setLocalizedDateFormatFromTemplate("EEE")
        return f
    }()
    private static let diaLargo: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.setLocalizedDateFormatFromTemplate("EEEE d MMM")
        return f
    }()
    private static let diaMes: DateFormatter = {
        let f = DateFormatter()
        f.locale = .current
        f.setLocalizedDateFormatFromTemplate("d MMM")
        return f
    }()

    static func diaCorto(_ fecha: Date) -> String {
        diaLargo.string(from: fecha).capitalized(with: .current)
    }

    /// Texto a la derecha de cada tarea: hora si la tiene; si no, cuándo cae respecto a hoy.
    static func etiqueta(_ tarea: TareaResumida, clase: VistaLista.Clase, ahora: Date) -> String {
        let textos = Textos.actual
        guard let fecha = tarea.fechaDeadline else { return textos.sinFecha }
        let calendario = Calendar.current
        let dias = calendario.dateComponents([.day], from: calendario.startOfDay(for: fecha), to: calendario.startOfDay(for: ahora)).day ?? 0
        switch clase {
        case .vencida:
            if dias == 0 { return hora.string(from: fecha) }
            if dias == 1 { return textos.ayer }
            return textos.haceDias(dias)
        case .hoy:
            return tarea.esTodoElDia ? textos.hoy.lowercased() : hora.string(from: fecha)
        case .proxima:
            if dias == -1 { return textos.manana }
            return diaSemana.string(from: fecha)
        case .seguimiento:
            return etiquetaSeguimiento(tarea, ahora: ahora)
        }
    }

    /// Para lo que espera al cliente: si toca preguntar, lo dice; si no, cuándo tocará; y sin día
    /// de seguimiento, cuánto lleva esperando.
    private static func etiquetaSeguimiento(_ tarea: TareaResumida, ahora: Date) -> String {
        let textos = Textos.actual
        let calendario = Calendar.current
        if let fecha = tarea.fechaSeguimiento {
            if tarea.tocaSeguimiento(ahora: ahora) { return textos.preguntar }
            let dias = calendario.dateComponents([.day], from: calendario.startOfDay(for: ahora), to: calendario.startOfDay(for: fecha)).day ?? 0
            if dias == 1 { return textos.manana }
            return dias <= Pendientes.diasProximos ? diaSemana.string(from: fecha) : diaMes.string(from: fecha)
        }
        if let dias = tarea.diasEsperando(ahora: ahora) { return textos.esperandoDias(dias) }
        return textos.sinFecha
    }

    /// Color del texto de la derecha: rojo si venció, color de marca si toca preguntar al cliente.
    static func color(_ tarea: TareaResumida, clase: VistaLista.Clase, ahora: Date) -> Color {
        switch clase {
        case .vencida: return .red
        case .seguimiento: return tarea.tocaSeguimiento(ahora: ahora) ? .marca : .secondary
        case .hoy, .proxima: return .secondary
        }
    }
}

extension View {
    /// En iOS 17+ el sistema pone el fondo y los márgenes; antes los ponemos nosotros.
    @ViewBuilder
    func fondoWidget() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) { Color(.systemBackground) }
        } else {
            padding(16).background(Color(.systemBackground))
        }
    }
}

extension Color {
    /// Teal de Lophex, el acento de la app.
    static let marca = Color(hex: "#008898")

    /// `#rrggbb` → Color. Los proyectos guardan el color así (src/domain/colores.ts).
    init(hex: String) {
        var valor: UInt64 = 0
        let limpio = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard limpio.count == 6, Scanner(string: limpio).scanHexInt64(&valor) else {
            self = .accentColor
            return
        }
        self.init(
            red: Double((valor >> 16) & 0xff) / 255,
            green: Double((valor >> 8) & 0xff) / 255,
            blue: Double(valor & 0xff) / 255
        )
    }
}

// MARK: - Datos de muestra (galería de widgets y previews)

extension Pendientes {
    static var ejemplo: Pendientes {
        let ahora = Date()
        let cal = Calendar.current
        func iso(_ fecha: Date) -> String { ISO8601DateFormatter().string(from: fecha) }
        func todoElDia(_ dias: Int) -> String {
            let dia = cal.date(byAdding: .day, value: dias, to: cal.startOfDay(for: ahora))!
            return iso(cal.date(bySettingHour: 23, minute: 59, second: 0, of: dia)!)
        }
        func tarea(
            _ id: String, _ titulo: String, _ deadline: String?, _ prioridad: String = "media", proyecto: (String, String)? = nil,
            esperandoDesde: String? = nil, seguimiento: String? = nil
        ) -> TareaResumida {
            TareaResumida(
                id: id, titulo: titulo, deadline: deadline, prioridad: prioridad, estado: "pendiente", estimadoMin: nil,
                proyecto: proyecto.map { TareaResumida.Proyecto(id: $0.0, nombre: $0.0, color: $0.1) },
                esperandoDesde: esperandoDesde, seguimiento: seguimiento
            )
        }
        let resumen = ResumenPendientes(
            version: 2, generadoEn: iso(ahora), dia: "",
            conteos: .init(vencidas: 1, hoy: 3, proximos7Dias: 2, sinDeadline: 4, seguimiento: 2),
            vencidas: [tarea("1", "Enviar cotización", todoElDia(-1), "alta", proyecto: ("Casa", "#f97316"))],
            hoy: [
                tarea("2", "Llamar al dentista", iso(cal.date(byAdding: .hour, value: 3, to: ahora)!)),
                tarea("3", "Revisar contrato", todoElDia(0), "alta", proyecto: ("Yucatours", "#0ea5e9")),
                tarea("4", "Comprar pintura", todoElDia(0), "baja", proyecto: ("Casa", "#f97316")),
            ],
            proximas: [
                tarea("5", "Entregar maquetas", todoElDia(1), "media", proyecto: ("Academia", "#22c55e")),
                tarea("6", "Pagar hosting", todoElDia(4)),
            ],
            seguimiento: [
                tarea("7", "Aprobación del logo", nil, proyecto: ("Yucatours", "#0ea5e9"), esperandoDesde: todoElDia(-6), seguimiento: todoElDia(0)),
                tarea("8", "Fotos del local", nil, proyecto: ("Casa", "#f97316"), esperandoDesde: todoElDia(-2)),
            ]
        )
        return Pendientes(resumen: resumen, ahora: ahora)
    }
}

struct BitacoraWidget_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            VistaWidget(entrada: Entrada(date: Date(), estado: .listo(.ejemplo)))
                .fondoWidget()
                .previewContext(WidgetPreviewContext(family: .systemLarge))
            VistaWidget(entrada: Entrada(date: Date(), estado: .listo(.ejemplo)))
                .fondoWidget()
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            VistaWidget(entrada: Entrada(date: Date(), estado: .listo(.ejemplo)))
                .fondoWidget()
                .previewContext(WidgetPreviewContext(family: .systemSmall))
            VistaWidget(entrada: Entrada(date: Date(), estado: .sinDatos))
                .fondoWidget()
                .previewContext(WidgetPreviewContext(family: .systemMedium))
        }
    }
}
