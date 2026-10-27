#!/usr/bin/env ruby
# frozen_string_literal: true

# Añade el target del widget (ios/App/BitacoraWidget) al proyecto de Xcode y conecta el plugin
# nativo con la app. Es idempotente: si el target ya existe no hace nada.
#
#   ruby scripts/agregar-widget-xcode.rb [--version 1.1]
#
# Usa la gema `xcodeproj` (viene con CocoaPods: `gem install xcodeproj` si falta).

require 'xcodeproj'

RUTA_PROYECTO = File.expand_path('../ios/App/App.xcodeproj', __dir__)
NOMBRE_WIDGET = 'BitacoraWidget'
BUNDLE_APP = 'com.sergiolopez.bitacora'
BUNDLE_WIDGET = "#{BUNDLE_APP}.widget"
DEPLOYMENT = '15.0'

version = ARGV.include?('--version') ? ARGV[ARGV.index('--version') + 1] : nil

proyecto = Xcodeproj::Project.open(RUTA_PROYECTO)
app = proyecto.targets.find { |t| t.name == 'App' } or abort 'No encuentro el target App'

if proyecto.targets.any? { |t| t.name == NOMBRE_WIDGET }
  puts "El target #{NOMBRE_WIDGET} ya existe; nada que hacer."
  exit 0
end

# --- App: plugin nativo, controlador raíz y entitlements -------------------------------------
grupo_app = proyecto.main_group['App']
fuentes_app = %w[WidgetPlugin.swift BitacoraViewController.swift].map do |nombre|
  grupo_app.files.find { |f| f.path == nombre } || grupo_app.new_file(nombre)
end
app.add_file_references(fuentes_app.reject { |ref| app.source_build_phase.files_references.include?(ref) })
grupo_app.new_file('App.entitlements') unless grupo_app.files.any? { |f| f.path == 'App.entitlements' }

app.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
  config.build_settings['MARKETING_VERSION'] = version if version
end

marketing = app.build_configurations.first.build_settings['MARKETING_VERSION']
build_actual = app.build_configurations.first.build_settings['CURRENT_PROJECT_VERSION']

# --- Widget: target, archivos y ajustes --------------------------------------------------------
widget = proyecto.new_target(:app_extension, NOMBRE_WIDGET, :ios, DEPLOYMENT, nil, :swift)
grupo_widget = proyecto.main_group.new_group(NOMBRE_WIDGET, NOMBRE_WIDGET)
fuentes_widget = %w[BitacoraWidget.swift Resumen.swift Textos.swift].map { |n| grupo_widget.new_file(n) }
grupo_widget.new_file('Info.plist')
grupo_widget.new_file("#{NOMBRE_WIDGET}.entitlements")
widget.add_file_references(fuentes_widget)
# La gema enlaza Foundation.framework con una ruta de SDK fija; Xcode lo enlaza solo, así que fuera.
widget.frameworks_build_phase.files.dup.each do |archivo|
  referencia = archivo.file_ref
  archivo.remove_from_project
  referencia&.remove_from_project
end
proyecto.frameworks_group.remove_from_project if proyecto.main_group['Frameworks']&.empty?

widget.build_configurations.each do |config|
  ajustes = config.build_settings
  ajustes['PRODUCT_BUNDLE_IDENTIFIER'] = BUNDLE_WIDGET
  ajustes['PRODUCT_NAME'] = '$(TARGET_NAME)'
  ajustes['INFOPLIST_FILE'] = "#{NOMBRE_WIDGET}/Info.plist"
  ajustes['GENERATE_INFOPLIST_FILE'] = 'NO'
  ajustes['CODE_SIGN_ENTITLEMENTS'] = "#{NOMBRE_WIDGET}/#{NOMBRE_WIDGET}.entitlements"
  ajustes['CODE_SIGN_STYLE'] = 'Automatic'
  ajustes['SWIFT_VERSION'] = '5.0'
  ajustes['TARGETED_DEVICE_FAMILY'] = '1,2'
  ajustes['IPHONEOS_DEPLOYMENT_TARGET'] = DEPLOYMENT
  ajustes['MARKETING_VERSION'] = marketing
  ajustes['CURRENT_PROJECT_VERSION'] = build_actual
  ajustes['SKIP_INSTALL'] = 'YES'
  ajustes['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  ajustes['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = config.name == 'Debug' ? 'DEBUG' : ''
  # Si el target App tiene equipo configurado, el widget usa el mismo.
  equipo = app.build_configurations.find { |c| c.name == config.name }&.build_settings&.dig('DEVELOPMENT_TEAM')
  ajustes['DEVELOPMENT_TEAM'] = equipo if equipo
end

# --- Empaquetar el widget dentro de la app -----------------------------------------------------
app.add_dependency(widget)
fase = app.copy_files_build_phases.find { |f| f.name == 'Embed Foundation Extensions' } ||
       app.new_copy_files_build_phase('Embed Foundation Extensions')
fase.dst_subfolder_spec = Xcodeproj::Constants::COPY_FILES_BUILD_PHASE_DESTINATIONS[:plug_ins]
fase.dst_path = ''
archivo = fase.add_file_reference(widget.product_reference, true)
archivo.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

atributos = proyecto.root_object.attributes
atributos['TargetAttributes'] ||= {}
atributos['TargetAttributes'][widget.uuid] = { 'CreatedOnToolsVersion' => '26.0', 'ProvisioningStyle' => 'Automatic' }

proyecto.save
puts "Target #{NOMBRE_WIDGET} añadido (#{BUNDLE_WIDGET}, versión #{marketing})."
puts 'Falta en Xcode: elegir el equipo en Signing & Capabilities de los dos targets.'
