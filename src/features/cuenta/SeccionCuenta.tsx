import { formatDistanceToNow, parseISO } from 'date-fns';
import { Cloud, CloudAlert, CloudOff, KeyRound, LoaderCircle, LogOut, RefreshCw } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useSincronizacion } from '../../data/sync/SincronizacionContext';
import type { EstadoSync } from '../../data/sync/tipos';
import { useAhora } from '../../hooks/useAhora';
import { useI18n } from '../../i18n/I18nProvider';
import type { Mensajes } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { Campo, Input } from '../../ui/Campos';
import { useToast } from '../../ui/Toast';

/** Igual que `minimum_password_length` en supabase/config.toml. */
const MINIMO_CONTRASENA = 8;

type Paso = 'correo' | 'codigo' | 'contrasena' | 'nueva';

/** Traduce los errores de Supabase Auth a algo que la persona pueda resolver. */
function mensajeError(error: unknown, t: Mensajes, paso: Paso): string {
  const { status, code } = (error ?? {}) as { status?: number; code?: string };
  if (status === 429 || code?.includes('rate_limit')) return t.cuenta.errorEspera;
  if (code === 'weak_password') return t.cuenta.errorDebil;
  if (code === 'same_password') return t.cuenta.errorIgual;
  if (paso === 'contrasena') return t.cuenta.errorContrasena;
  if (paso === 'codigo') return t.cuenta.errorCodigo;
  if (paso === 'nueva') return t.errores.generico;
  return t.cuenta.errorCorreo;
}

/** Sección de Ajustes: estado de la cuenta y la sincronización. Entrar se hace en PantallaAcceso. */
export function SeccionCuenta() {
  const { t } = useI18n();
  const { estado, servicio } = useSincronizacion();
  if (!servicio.disponible) return null;

  return (
    <section>
      <h3 className="mb-2 text-[13px] font-medium text-texto-2">{t.cuenta.titulo}</h3>
      {estado.fase === 'sin-sesion' || estado.fase === 'iniciando' ? (
        <FormularioEntrar />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Cuenta nueva: se pide la contraseña en cuanto entra con el código. */}
          {estado.sinContrasena && (
            <div className="rounded-xl border border-acento/40 bg-acento-suave/40 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="size-4 text-acento" aria-hidden />
                {t.cuenta.crearTitulo}
              </p>
              <p className="mt-1 mb-4 text-[13px] text-texto-2">{t.cuenta.crearTexto}</p>
              <FormularioContrasena />
            </div>
          )}
          <Conectado estado={estado} />
        </div>
      )}
    </section>
  );
}

/** Entrar con contraseña o con código por correo. Lo usa PantallaAcceso. */
export function FormularioEntrar() {
  const { t } = useI18n();
  const { servicio } = useSincronizacion();
  const ids = { correo: useId(), contrasena: useId(), codigo: useId() };
  const [paso, setPaso] = useState<Exclude<Paso, 'nueva'>>('contrasena');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string>();

  const cambiarPaso = (siguiente: Exclude<Paso, 'nueva'>) => {
    setPaso(siguiente);
    setError(undefined);
    setCodigo('');
  };

  /** Ejecuta una acción de Auth mostrando el error del paso actual. */
  const intentar = async (accion: () => Promise<void>, alTerminar?: () => void) => {
    setOcupado(true);
    setError(undefined);
    try {
      await accion();
      alTerminar?.();
    } catch (err) {
      console.error(err);
      setError(mensajeError(err, t, paso));
    } finally {
      // Al entrar, el servicio cambia de fase y esta vista se sustituye sola.
      setOcupado(false);
    }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (ocupado || !correo.trim()) return;
    if (paso === 'contrasena') {
      if (contrasena) void intentar(() => servicio.entrarConContrasena(correo, contrasena));
    } else if (paso === 'correo') {
      void intentar(() => servicio.enviarCodigo(correo), () => setPaso('codigo'));
    } else if (codigo.replace(/\D/g, '').length >= 6) {
      void intentar(() => servicio.verificarCodigo(correo, codigo));
    }
  };

  const campoCorreo = (
    <Campo etiqueta={t.cuenta.correo} htmlFor={ids.correo}>
      <Input
        id={ids.correo}
        type="email"
        autoComplete="email"
        inputMode="email"
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        placeholder={t.cuenta.correoPlaceholder}
      />
    </Campo>
  );
  const enlace = (texto: string, siguiente: Exclude<Paso, 'nueva'>) => (
    <button
      type="button"
      onClick={() => cambiarPaso(siguiente)}
      className="cursor-pointer self-start text-left text-[13px] font-medium text-acento hover:text-acento-hover"
    >
      {texto}
    </button>
  );

  return (
    <div className="rounded-xl border border-borde p-4">
      <p className="mb-4 text-[13px] text-texto-2">{t.cuenta.explicacion}</p>
      <form onSubmit={enviar} className="flex flex-col gap-3">
        {paso === 'contrasena' && (
          <>
            {campoCorreo}
            <Campo etiqueta={t.cuenta.contrasena} htmlFor={ids.contrasena}>
              <Input
                id={ids.contrasena}
                type="password"
                autoComplete="current-password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
              />
            </Campo>
            <Button type="submit" variante="primario" disabled={!correo.trim() || !contrasena || ocupado}>
              {t.cuenta.entrar}
            </Button>
            {enlace(t.cuenta.usarCodigo, 'correo')}
          </>
        )}
        {paso === 'correo' && (
          <>
            {campoCorreo}
            <Button type="submit" variante="primario" disabled={!correo.trim() || ocupado}>
              {t.cuenta.enviarCodigo}
            </Button>
            {enlace(t.cuenta.usarContrasena, 'contrasena')}
          </>
        )}
        {paso === 'codigo' && (
          <>
            <p className="text-sm">{t.cuenta.codigoEnviado(correo.trim())}</p>
            <Campo etiqueta={t.cuenta.codigo} htmlFor={ids.codigo}>
              <Input
                id={ids.codigo}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={8}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="text-center text-lg tracking-[0.4em] tabular-nums md:text-lg"
              />
            </Campo>
            <div className="flex gap-2">
              <Button variante="ghost" onClick={() => cambiarPaso('correo')}>
                {t.cuenta.otroCorreo}
              </Button>
              <Button type="submit" variante="primario" disabled={codigo.replace(/\D/g, '').length < 6 || ocupado} className="ml-auto">
                {t.cuenta.entrar}
              </Button>
            </div>
          </>
        )}
      </form>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}

/** Crear (cuenta nueva) o cambiar la contraseña de la sesión actual. */
function FormularioContrasena({ alTerminar }: { alTerminar?: () => void }) {
  const { t } = useI18n();
  const { estado, servicio } = useSincronizacion();
  const { mostrar } = useToast();
  const ids = { nueva: useId(), confirmar: useId() };
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string>();

  const corta = nueva.length > 0 && nueva.length < MINIMO_CONTRASENA;
  const distintas = confirmar.length > 0 && confirmar !== nueva;
  const valida = nueva.length >= MINIMO_CONTRASENA && confirmar === nueva;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valida || ocupado) return;
    setOcupado(true);
    setError(undefined);
    try {
      await servicio.definirContrasena(nueva);
      mostrar({ mensaje: t.cuenta.contrasenaGuardada });
      alTerminar?.();
    } catch (err) {
      console.error(err);
      setError(mensajeError(err, t, 'nueva'));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      {/* Ayuda a los gestores de contraseñas a asociarla con la cuenta. */}
      <input type="email" autoComplete="username" value={estado.correo ?? ''} readOnly hidden />
      <Campo etiqueta={t.cuenta.nueva} htmlFor={ids.nueva} ayuda={corta ? undefined : t.cuenta.minimo}>
        <Input
          id={ids.nueva}
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          aria-invalid={corta || undefined}
        />
        {corta && <p className="text-xs text-peligro">{t.cuenta.minimo}</p>}
      </Campo>
      <Campo etiqueta={t.cuenta.confirmar} htmlFor={ids.confirmar}>
        <Input
          id={ids.confirmar}
          type="password"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          aria-invalid={distintas || undefined}
        />
        {distintas && <p className="text-xs text-peligro">{t.cuenta.noCoinciden}</p>}
      </Campo>
      <div className="flex gap-2">
        {alTerminar && (
          <Button variante="ghost" onClick={alTerminar}>
            {t.acciones.cancelar}
          </Button>
        )}
        <Button type="submit" variante="primario" disabled={!valida || ocupado} className="ml-auto">
          {t.cuenta.guardarContrasena}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-peligro">
          {error}
        </p>
      )}
    </form>
  );
}

function Conectado({ estado }: { estado: EstadoSync }) {
  const { t, locale } = useI18n();
  const { servicio } = useSincronizacion();
  const [cambiando, setCambiando] = useState(false);
  // Refresca el "hace N minutos".
  useAhora();

  const linea =
    estado.fase === 'sincronizando'
      ? { icono: LoaderCircle, texto: t.cuenta.sincronizando, clase: 'text-texto-2', girar: true }
      : estado.fase === 'sin-conexion'
        ? { icono: CloudOff, texto: t.cuenta.sinConexion, clase: 'text-aviso' }
        : estado.fase === 'error'
          ? { icono: CloudAlert, texto: t.cuenta.error, clase: 'text-peligro' }
          : {
              icono: Cloud,
              texto: estado.ultimaVez
                ? t.cuenta.alDia(formatDistanceToNow(parseISO(estado.ultimaVez), { addSuffix: true, locale }))
                : t.cuenta.sincronizando,
              clase: 'text-acento',
            };
  const Icono = linea.icono;

  return (
    <div className="rounded-xl border border-borde p-4">
      {estado.correo && <p className="truncate text-sm font-medium">{t.cuenta.conectado(estado.correo)}</p>}
      <p role="status" className={cn('mt-1.5 flex items-center gap-1.5 text-[13px]', linea.clase)}>
        <Icono className={cn('size-4', linea.girar && 'animate-spin')} aria-hidden />
        {linea.texto}
      </p>
      {estado.fase === 'error' && estado.error && <p className="mt-1 text-xs break-words text-texto-3">{estado.error}</p>}

      {cambiando ? (
        <div className="mt-4 border-t border-borde pt-4">
          <p className="mb-3 text-sm font-medium">{t.cuenta.cambiarContrasena}</p>
          <FormularioContrasena alTerminar={() => setCambiando(false)} />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            icono={<RefreshCw className="size-4" />}
            onClick={() => void servicio.sincronizarAhora()}
            disabled={estado.fase === 'sincronizando'}
          >
            {t.cuenta.sincronizarAhora}
          </Button>
          {!estado.sinContrasena && (
            <Button variante="ghost" icono={<KeyRound className="size-4" />} onClick={() => setCambiando(true)}>
              {t.cuenta.cambiarContrasena}
            </Button>
          )}
          <Button variante="ghost" icono={<LogOut className="size-4" />} onClick={() => void servicio.cerrarSesion()} title={t.cuenta.cerrarSesionAyuda}>
            {t.cuenta.cerrarSesion}
          </Button>
        </div>
      )}
    </div>
  );
}
