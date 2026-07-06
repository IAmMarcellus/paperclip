import type { UIAdapterModule } from "../types";
import { SchemaConfigFields, buildSchemaAdapterConfig } from "../schema-config-fields";
import { parseOpenSageStdoutLine } from "./parse-stdout";

// Config is rendered from the server adapter's getConfigSchema() via the shared
// schema-driven form (same pattern as cursor_cloud), so no custom React fields.
export const openSageUIAdapter: UIAdapterModule = {
  type: "opensage",
  label: "OpenSage",
  parseStdoutLine: parseOpenSageStdoutLine,
  ConfigFields: SchemaConfigFields,
  buildAdapterConfig: buildSchemaAdapterConfig,
};
