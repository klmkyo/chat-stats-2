import { ComponentProps, JSXElementConstructor, ReactElement, ReactNode, isValidElement } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isElementOfType<T extends JSXElementConstructor<any>>(
  node: ReactNode,
  component: T
): node is ReactElement<ComponentProps<T>, T> {
  return isValidElement(node) && node.type === component;
}