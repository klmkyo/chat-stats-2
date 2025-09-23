/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentProps, JSXElementConstructor, ReactElement, ReactNode, isValidElement } from "react";

 
export function isElementOfType<T extends JSXElementConstructor<any>>(
  node: ReactNode,
  component: T
): node is ReactElement<ComponentProps<T>, T> {
  return isValidElement(node) && (node.type === component || (node.type as any)?.displayName === (component as any).displayName || (node.type as any)?.name === component.name);
}