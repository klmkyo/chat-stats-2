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

  var errorDescription: String? {
    switch self {
    case .noViewController: return "Unable to find presenting view controller"
    case .noFileSelected: return "No file was selected"
    case .fileAccessDenied: return "Failed to access selected file"
    case .fileDescriptorFailed: return "Failed to duplicate file descriptor"
    case .processingFailed: return "Failed to process ZIP file"
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
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ProcessorBridge')` in JavaScript.
    Name("ProcessorBridge")

    // Defines event names that the module can send to JavaScript.
    Events("onChange")

    // Function to pick a ZIP file and get its contents as JSON
    AsyncFunction("pickAndListZip") { (promise: Promise) in
      DispatchQueue.main.async {
        guard let presenter = self.appContext?.utilities?.currentViewController() else {
          promise.reject(ProcessorBridgeError.noViewController.nsError)
          return
        }

        let picker = UIDocumentPickerViewController(
          forOpeningContentTypes: [UTType.zip], asCopy: false)

        let delegate = ZipPickerDelegate { result in
          switch result {
          case .success(let text):
            promise.resolve(text)
          case .failure(let error):
            promise.reject(error)
          }
        }

        // Retain delegate until completion
        ZipPickerDelegate.hold(delegate)
        picker.delegate = delegate
        presenter.present(picker, animated: true)
      }
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

private class ZipPickerDelegate: NSObject, UIDocumentPickerDelegate {
  typealias Completion = (Result<String, NSError>) -> Void
  private let completion: Completion

  init(_ completion: @escaping Completion) {
    self.completion = completion
  }

  // Thread-safe delegate retention using a dictionary keyed by ObjectIdentifier
  private static var delegates: [ObjectIdentifier: ZipPickerDelegate] = [:]
  private static let delegatesQueue = DispatchQueue(
    label: "ProcessorBridge.delegates", attributes: .concurrent)

  static func hold(_ delegate: ZipPickerDelegate) {
    delegatesQueue.async(flags: .barrier) {
      delegates[ObjectIdentifier(delegate)] = delegate
    }
  }

  private func releaseSelf() {
    Self.delegatesQueue.async(flags: .barrier) {
      Self.delegates.removeValue(forKey: ObjectIdentifier(self))
    }
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL])
  {
    defer { releaseSelf() }

    guard let url = urls.first else {
      completion(.failure(ProcessorBridgeError.noFileSelected.nsError))
      return
    }

    guard url.startAccessingSecurityScopedResource() else {
      completion(.failure(ProcessorBridgeError.fileAccessDenied.nsError))
      return
    }
    defer { url.stopAccessingSecurityScopedResource() }

    do {
      let fh = try FileHandle(forReadingFrom: url)
      defer { fh.closeFile() }

      // Duplicate the file descriptor - Rust will take ownership and close it
      let ownedFd = fcntl(fh.fileDescriptor, F_DUPFD_CLOEXEC, 0)
      guard ownedFd >= 0 else {
        completion(.failure(ProcessorBridgeError.fileDescriptorFailed.nsError))
        return
      }

      // Call Rust to process the ZIP file
      if let cPtr = rust_zip_list_fd(Int32(ownedFd)) {
        let text = String(cString: cPtr)
        rust_string_free(cPtr)  // Always free the C string
        completion(.success(text))
      } else {
        completion(.failure(ProcessorBridgeError.processingFailed.nsError))
      }
    } catch {
      completion(.failure(error as NSError))
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    defer { releaseSelf() }
    completion(
      .failure(NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError, userInfo: nil)))
  }
}
