import Darwin
import ExpoModulesCore
import Foundation
import UIKit
import UniformTypeIdentifiers

// MARK: - Custom Error Types
enum ProcessorBridgeError: Int, Error, LocalizedError {
  case noViewController = 1000
  case noFileSelected = 1001
  case fileAccessDenied = 1002
  case fileDescriptorFailed = 1003
  case processingFailed = 1004
  case invalidDatabasePath = 1005
  case importCancelled = 1006

  var errorDescription: String? {
    switch self {
    case .noViewController: return "Unable to find presenting view controller"
    case .noFileSelected: return "No file was selected"
    case .fileAccessDenied: return "Failed to access selected file"
    case .fileDescriptorFailed: return "Failed to duplicate file descriptor"
    case .processingFailed: return "Failed to process ZIP file"
    case .invalidDatabasePath: return "Database path is invalid"
    case .importCancelled: return "Import was cancelled"
    }
  }

  var nsError: NSError {
    return NSError(
      domain: "ProcessorBridge",
      code: self.rawValue,
      userInfo: [NSLocalizedDescriptionKey: self.errorDescription ?? "Unknown error"]
    )
  }
}

public class ProcessorBridgeModule: Module {
  private static var currentProgressModule: ProcessorBridgeModule?

  private static let progressCallback: @convention(c) (UInt32, UInt32) -> Void = { processed, total in
    ProcessorBridgeModule.handleProgress(processed: processed, total: total)
  }

  private static func handleProgress(processed: UInt32, total: UInt32) {
    DispatchQueue.main.async {
      guard let module = ProcessorBridgeModule.currentProgressModule else {
        return
      }

      module.sendEvent(
        "onImportProgress",
        [
          "processed": processed,
          "total": total,
        ])
    }
  }

  private func beginProgressUpdates() {
    ProcessorBridgeModule.currentProgressModule = self
    processor_set_progress_callback(ProcessorBridgeModule.progressCallback)
  }

  private func endProgressUpdates() {
    processor_clear_progress_callback()
    ProcessorBridgeModule.currentProgressModule = nil
  }

  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ProcessorBridge')` in JavaScript.
    Name("ProcessorBridge")

    // Defines event names that the module can send to JavaScript.
    Events("onChange", "onImportProgress")

    AsyncFunction("pickAndListZip") { () -> [String] in
      []
    }

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("setValueAsync") { (value: String) in
      // Send an event to JavaScript.
      self.sendEvent(
        "onChange",
        [
          "value": value
        ])
    }

    AsyncFunction("importMessengerArchives") { (filePaths: [String], dbPath: String) -> String in
      guard !dbPath.isEmpty else {
        throw ProcessorBridgeError.invalidDatabasePath
      }

      if filePaths.isEmpty {
        throw ProcessorBridgeError.processingFailed
      }

      self.beginProgressUpdates()
      defer { self.endProgressUpdates() }

      let jsonData = try JSONSerialization.data(withJSONObject: filePaths, options: [])
      guard let jsonString = String(data: jsonData, encoding: .utf8) else {
        throw ProcessorBridgeError.processingFailed
      }

      let result = jsonString.withCString { filesPtr in
        dbPath.withCString { databasePtr in
          processor_import_messenger_archives_json(filesPtr, databasePtr)
        }
      }

      guard let cString = result else {
        throw ProcessorBridgeError.processingFailed
      }

      let status = String(cString: cString)

      switch status {
      case "success":
        return status
      case "cancelled":
        return status
      default:
        throw ProcessorBridgeError.processingFailed
      }
    }

    AsyncFunction("cancelImport") {
      processor_request_cancel_import()
    }

    // Enables the module to be used as a native view. Definition components that are accepted as part of the
    // view definition: Prop, Events.
    View(ProcessorBridgeView.self) {
      // Defines a setter for the `url` prop.
      Prop("url") { (view: ProcessorBridgeView, url: URL) in
        if view.webView.url != url {
          view.webView.load(URLRequest(url: url))
        }
      }

      Events("onLoad")
    }
  }
}
