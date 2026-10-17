Pod::Spec.new do |s|
  s.name = 'WhisperPrivacy'
  s.version = '1.0.0'
  s.summary = 'Whisper native privacy lifecycle'
  s.description = 'Opaque native covers for inactive and captured application windows.'
  s.license = { :type => 'Proprietary' }
  s.author = 'Whisper'
  s.homepage = 'https://whisperchatapp.duckdns.org'
  s.source = { :git => 'https://whisperchatapp.duckdns.org' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
