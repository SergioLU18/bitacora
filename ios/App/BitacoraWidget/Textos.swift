import Foundation

/// Textos del widget. Sigue el idioma del sistema (la preferencia de la app vive en la web);
/// español por defecto, igual que la app.
struct Textos {
    let vencidas: String
    let hoy: String
    let proximas: String
    let seguimiento: String
    let sinFecha: String
    let preguntar: String
    let esperandoDias: (Int) -> String
    let nadaPendiente: String
    let nadaPendienteDetalle: String
    let abreLaApp: String
    let abreLaAppDetalle: String
    let masPendientes: (Int) -> String
    let ayer: String
    let haceDias: (Int) -> String
    let manana: String
    let nombreWidget: String
    let descripcionWidget: String

    static var actual: Textos {
        let idioma = Locale.current.languageCode ?? "es"
        return idioma == "en" ? en : es
    }

    static let es = Textos(
        vencidas: "Vencidas",
        hoy: "Hoy",
        proximas: "Próximos días",
        seguimiento: "Del cliente",
        sinFecha: "sin fecha",
        preguntar: "preguntar",
        esperandoDias: { n in n == 0 ? "desde hoy" : "\(n) d esperando" },
        nadaPendiente: "Nada pendiente",
        nadaPendienteDetalle: "Sin vencidas, tareas para hoy ni nada del cliente.",
        abreLaApp: "Abre Bitácora",
        abreLaAppDetalle: "El widget se llena al abrir la app.",
        masPendientes: { n in n == 1 ? "1 más" : "\(n) más" },
        ayer: "ayer",
        haceDias: { n in "hace \(n) d" },
        manana: "mañana",
        nombreWidget: "Pendientes",
        descripcionWidget: "Tareas vencidas, de hoy, de los próximos días y lo que espera al cliente."
    )

    static let en = Textos(
        vencidas: "Overdue",
        hoy: "Today",
        proximas: "Coming up",
        seguimiento: "On the client",
        sinFecha: "no date",
        preguntar: "follow up",
        esperandoDias: { n in n == 0 ? "since today" : "waiting \(n)d" },
        nadaPendiente: "All clear",
        nadaPendienteDetalle: "Nothing overdue, due today or waiting on a client.",
        abreLaApp: "Open Bitácora",
        abreLaAppDetalle: "The widget fills in once you open the app.",
        masPendientes: { n in n == 1 ? "1 more" : "\(n) more" },
        ayer: "yesterday",
        haceDias: { n in "\(n)d ago" },
        manana: "tomorrow",
        nombreWidget: "To-do",
        descripcionWidget: "Overdue tasks, today's tasks, what's coming up and what's waiting on clients."
    )
}
