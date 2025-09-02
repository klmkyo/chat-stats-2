Pod::Spec.new do |s|
  s.name           = 'ProcessorBridge'
  s.version        = '1.0.0'
  s.summary        = 'A sample project summary'
  s.description    = 'A sample project description'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'OTHER_LDFLAGS' => '-lprocessor'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  s.vendored_frameworks = "./Vendored/Processor/Processor.xcframework"
  # s.public_header_files = 'processor.h'
  # s.header_mappings_dir = "."

  # s.vendored_libraries = "./Vendored/Processor/libprocessor-ios.a", "./Vendored/Processor/libprocessor-ios-sim.a"

  # s.script_phase = {
  #   :name => 'Sync Processor.xcframework',
  #   :script => '/bin/bash "${PODS_TARGET_SRCROOT}/scripts/sync-processor.sh"',
  #   :execution_position => :before_compile,
  #   :input_files => ['${PODS_TARGET_SRCROOT}/scripts/sync-processor.sh'],
  #   :output_files => ['${PODS_TARGET_SRCROOT}/Vendored/Processor/Processor.xcframework/Info.plist']
  # }
end
