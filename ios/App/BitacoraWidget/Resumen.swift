import Foundation

// Espejo de `ResumenPendientes` (src/domain/resumen.ts, version 2). La app lo escribe como JSON
// en el App Group; aquí solo se lee y se reclasifica por fecha. Lo de la versión 1 (sin
// `seguimiento`) se sigue leyendo hasta que la app vuelva a escribir.

struct ResumenPendientes: Decodable {
    struct Conteos: Decodable {
        let vencidas: Int
        let hoy: Int
        let proximos7Dias: Int
        let sinDeadline: Int
        let seguimiento: Int?
    }

    let version: Int
    let generadoEn: String
    let dia: String
    let conteos: Conteos
    let vencidas: [TareaResumida]
    let hoy: [TareaResumida]
    let proximas: [TareaResumida]
    /// Lo que espera al cliente, con o sin día de seguimiento, ya ordenado por la app.
    let seguimiento: [TareaResumida]?
}

struct TareaResumida: Decodable, Identifiable, Hashable {
    struct Proyecto: Decodable, Hashable {
        let id: String
        let nombre: String
        let color: String
    }

    let id: String
    let titulo: String
    let deadline: String?
    let prioridad: String
    let estado: String
    let estimadoMin: Int?
    let proyecto: Proyecto?
    let esperandoDesde: String?
    let seguimiento: String?

    var fechaDeadline: Date? { deadline.flatMap(FechaISO.leer) }
    var fechaSeguimiento: Date? { seguimiento.flatMap(FechaISO.leer) }
    var fechaEsperandoDesde: Date? { esperandoDesde.flatMap(FechaISO.leer) }

    /// Igual que `tocaSeguimiento` en la web: el día de seguimiento es hoy o ya pasó.
    func tocaSeguimiento(ahora: Date) -> Bool {
        guard let fecha = fechaSeguimiento else { return false }
        let calendario = Calendar.current
        let manana = calendario.date(byAdding: .day, value: 1, to: calendario.startOfDay(for: ahora)) ?? ahora
        return fecha < manana
    }

    /// Días naturales que lleva esperando al cliente (0 = desde hoy).
    func diasEsperando(ahora: Date) -> Int? {
        guard let desde = fechaEsperandoDesde else { return nil }
        let calendario = Calendar.current
        let dias = calendario.dateComponents([.day], from: calendario.startOfDay(for: desde), to: calendario.startOfDay(for: ahora)).day ?? 0
        return max(0, dias)
    }

    /// Igual que `esTodoElDia` en la web: una fecha sin hora se guarda a las 23:59 locales.
    var esTodoElDia: Bool {
        guard let fecha = fechaDeadline else { return false }
        let partes = Calendar.current.dateComponents([.hour, .minute], from: fecha)
        return partes.hour == 23 && partes.minute == 59
    }

    var pesoPrioridad: Int {
        switch prioridad {
        case "alta": return 0
        case "media": return 1
        default: return 2
        }
    }
}

enum FechaISO {
    private static let conFraccion: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let sinFraccion: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func leer(_ texto: String) -> Date? {
        conFraccion.date(from: texto) ?? sinFraccion.date(from: texto)
    }
}

/// Lo que el widget dibuja: el resumen ya reclasificado respecto a `ahora`.
struct Pendientes {
    struct Seccion {
        var tareas: [TareaResumida] = []
        /// Total real; puede superar `tareas.count` porque la app exporta como mucho 12 por lista.
        var total: Int = 0
    }

    var vencidas = Seccion()
    var hoy = Seccion()
    var proximas = Seccion()
    /// En la cancha del cliente y sin aparecer ya en las listas por fecha.
    var seguimiento = Seccion()
    var sinDeadline = 0
    var generadoEn: Date?

    var totalConFecha: Int { vencidas.total + hoy.total + proximas.total }
    /// Todo lo que el widget puede listar.
    var totalListado: Int { totalConFecha + seguimiento.total }
    var estaVacio: Bool { totalListado == 0 }

    static let diasProximos = 7

    /// Reparte de nuevo las tareas según su deadline: lo que era "hoy" al generarse puede estar
    /// vencido ya, y lo que era "mañana" puede ser hoy. Las tareas que quedaron fuera de las
    /// listas por el tope se mantienen contadas en su sección original.
    init(resumen: ResumenPendientes, ahora: Date = Date()) {
        generadoEn = FechaISO.leer(resumen.generadoEn)
        sinDeadline = resumen.conteos.sinDeadline

        vencidas.total = resumen.conteos.vencidas - resumen.vencidas.count
        hoy.total = resumen.conteos.hoy - resumen.hoy.count
        proximas.total = resumen.conteos.proximos7Dias - resumen.proximas.count

        let calendario = Calendar.current
        var vistas = Set<String>()
        for tarea in resumen.vencidas + resumen.hoy + resumen.proximas {
            guard vistas.insert(tarea.id).inserted, let fecha = tarea.fechaDeadline else { continue }
            if fecha < ahora {
                vencidas.tareas.append(tarea)
            } else {
                let dias = calendario.dateComponents([.day], from: calendario.startOfDay(for: ahora), to: calendario.startOfDay(for: fecha)).day ?? 0
                if dias == 0 {
                    hoy.tareas.append(tarea)
                } else if dias <= Self.diasProximos {
                    proximas.tareas.append(tarea)
                }
            }
        }

        let ordenar: (TareaResumida, TareaResumida) -> Bool = { a, b in
            let fa = a.fechaDeadline ?? .distantFuture
            let fb = b.fechaDeadline ?? .distantFuture
            if fa != fb { return fa < fb }
            return a.pesoPrioridad < b.pesoPrioridad
        }
        vencidas.tareas.sort(by: ordenar)
        hoy.tareas.sort(by: ordenar)
        proximas.tareas.sort(by: ordenar)

        vencidas.total = max(0, vencidas.total) + vencidas.tareas.count
        hoy.total = max(0, hoy.total) + hoy.tareas.count
        proximas.total = max(0, proximas.total) + proximas.tareas.count

        // Lo que espera al cliente va aparte, sin repetir lo que ya se ve por su fecha límite.
        // El orden (primero lo que toca preguntar, luego la espera más larga) no depende de la
        // hora, así que se conserva tal cual lo mandó la app.
        seguimiento.tareas = (resumen.seguimiento ?? []).filter { !vistas.contains($0.id) }
        let fueraDeLista = max(0, (resumen.conteos.seguimiento ?? 0) - (resumen.seguimiento?.count ?? 0))
        seguimiento.total = seguimiento.tareas.count + fueraDeLista
    }

    init() {}

    /// Momentos en que el reparto cambia sin que la app intervenga: cada deadline de hoy que se
    /// cumple y la medianoche. WidgetKit los usa como entradas de la línea de tiempo.
    func momentosDeCambio(desde ahora: Date, maximo: Int = 8) -> [Date] {
        let calendario = Calendar.current
        var momentos = hoy.tareas.compactMap(\.fechaDeadline).filter { $0 > ahora }
        if let medianoche = calendario.nextDate(after: ahora, matching: DateComponents(hour: 0, minute: 0, second: 5), matchingPolicy: .nextTime) {
            momentos.append(medianoche)
        }
        return Array(Set(momentos)).sorted().prefix(maximo).map { $0 }
    }
}

enum AlmacenResumen {
    static let appGroup = "group.com.sergiolopez.bitacora"
    static let archivo = "resumen.json"

    enum Estado {
        /// La app todavía no ha escrito nada (nunca se abrió con este binario).
        case sinDatos
        case listo(Pendientes)
    }

    static func cargar(ahora: Date = Date()) -> Estado {
        guard
            let contenedor = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
            let datos = try? Data(contentsOf: contenedor.appendingPathComponent(archivo)),
            let resumen = try? JSONDecoder().decode(ResumenPendientes.self, from: datos)
        else { return .sinDatos }
        return .listo(Pendientes(resumen: resumen, ahora: ahora))
    }
}
