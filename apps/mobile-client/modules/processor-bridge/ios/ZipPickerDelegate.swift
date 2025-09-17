//
//  ZipPickerDelegate.swift
//
//
//  Created by Marcin Klimek on 10/09/2025.
//

import Darwin
import ExpoModulesCore
import Foundation
import UIKit
import UniformTypeIdentifiers

class ZipPickerDelegate: NSObject, UIDocumentPickerDelegate {
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
    guard let url = urls.first else {
      completion(.failure(ProcessorBridgeError.noFileSelected.nsError))
      releaseSelf()
      return
    }

    // Perform heavy work off the main actor to keep UI responsive
    Task(priority: .userInitiated) { [self] in
      guard url.startAccessingSecurityScopedResource() else {
        await MainActor.run {
          completion(.failure(ProcessorBridgeError.fileAccessDenied.nsError))
          releaseSelf()
        }
        return
      }
      defer { url.stopAccessingSecurityScopedResource() }

      do {
        let fh = try FileHandle(forReadingFrom: url)
        defer { fh.closeFile() }

        // Duplicate the file descriptor - Rust will take ownership and close it
        let ownedFd = fcntl(fh.fileDescriptor, F_DUPFD_CLOEXEC, 0)
        guard ownedFd >= 0 else {
          await MainActor.run {
            completion(.failure(ProcessorBridgeError.fileDescriptorFailed.nsError))
            releaseSelf()
          }
          return
        }
        

        // Call Rust to process the ZIP file
//        if let cPtr = rust_zip_list_fd(Int32(ownedFd)) {
//          let text = String(cString: cPtr)
//          rust_string_free(cPtr)  // Always free the C string
//          await MainActor.run {
//            completion(.success(text))
//            releaseSelf()
//          }
//        } else {
//          await MainActor.run {
//            completion(.failure(ProcessorBridgeError.processingFailed.nsError))
//            releaseSelf()
//          }
//        }
      } catch {
        await MainActor.run {
          completion(.failure(error as NSError))
          releaseSelf()
        }
      }
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    defer { releaseSelf() }
    completion(
      .failure(NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError, userInfo: nil)))
  }
}
