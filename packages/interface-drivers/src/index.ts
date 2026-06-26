export type InterfaceDriverKind =
  | "rest"
  | "graphql"
  | "grpc"
  | "mcp"
  | "browser_ui"
  | "desktop_ui"
  | "cli"
  | "sdk"
  | "database"
  | "filesystem"
  | "local_os"
  | "ipc"
  | "message_queue"
  | "human";

export interface InterfaceDriverManifest {
  id: string;
  kind: InterfaceDriverKind;
  permissions: string[];
  supportedOperations: string[];
}
