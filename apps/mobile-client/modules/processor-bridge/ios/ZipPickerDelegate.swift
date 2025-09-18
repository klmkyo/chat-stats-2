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
  typealias Completion = (Result<[String], NSError>) -> Void
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
    if urls.isEmpty {
      completion(.failure(ProcessorBridgeError.noFileSelected.nsError))
      releaseSelf()
      return
    }

    Task(priority: .userInitiated) { [self] in
      var results: [String] = []

      for url in urls {
        if !url.startAccessingSecurityScopedResource() {
          await MainActor.run {
            completion(.failure(ProcessorBridgeError.fileAccessDenied.nsError))
            releaseSelf()
          }
          return
        }

        defer { url.stopAccessingSecurityScopedResource() }

        do {
          // For now, pass the file path to the Rust layer that returns a JSON string for each archive
          let json: String? = url.path.withCString { cPath in
            if let cPtr = processor_list_archive_contents(cPath) {
              defer { processor_string_free(cPtr) }
              return String(cString: cPtr)
            } else {
              return nil
            }
          }

          guard let json = json else {
            await MainActor.run {
              completion(.failure(ProcessorBridgeError.processingFailed.nsError))
              releaseSelf()
            }
            return
          }

          results.append(json)
        } catch {
          await MainActor.run {
            completion(.failure(error as NSError))
            releaseSelf()
          }
          return
        }
      }

      await MainActor.run {
        completion(.success(results))
        releaseSelf()
      }
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    defer { releaseSelf() }
    completion(
      .failure(NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError, userInfo: nil)))
  }
}
