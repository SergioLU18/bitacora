-- Archivos de proyecto (cotizaciones, contratos…).
--
-- Los datos del archivo (nombre, tipo, tamaño) se sincronizan como las demás entidades, en la
-- tabla `archivos`. El contenido va al bucket privado `archivos`, en "<user_id>/<archivo_id>":
-- cada cuenta solo puede leer y escribir su propia carpeta. Como en las tablas, no hay borrado
-- físico (eliminar un archivo es `datos.eliminadoEn`).

create table public.archivos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  datos jsonb not null,
  updated_at timestamptz not null,
  servidor_en timestamptz not null default clock_timestamp()
);
create index archivos_user_servidor_en on public.archivos (user_id, servidor_en);

create trigger antes_de_sincronizar
  before insert or update on public.archivos
  for each row execute function public.antes_de_sincronizar();

alter table public.archivos enable row level security;
create policy "ver lo propio" on public.archivos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "crear lo propio" on public.archivos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "editar lo propio" on public.archivos
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.archivos from anon;
revoke delete, truncate on public.archivos from authenticated;

alter publication supabase_realtime add table public.archivos;

-- Contenido. 50 MB por archivo: el máximo del plan gratuito.
insert into storage.buckets (id, name, public, file_size_limit)
values ('archivos', 'archivos', false, 52428800)
on conflict (id) do nothing;

create policy "ver archivos propios" on storage.objects
  for select to authenticated
  using (bucket_id = 'archivos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "subir archivos propios" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'archivos' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Reemplazar (upsert) un contenido ya subido, p. ej. si se cortó la conexión a medias.
create policy "reemplazar archivos propios" on storage.objects
  for update to authenticated
  using (bucket_id = 'archivos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'archivos' and (storage.foldername(name))[1] = (select auth.uid())::text);
