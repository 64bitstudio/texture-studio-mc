export interface InlineErrorProps {
  message: string;
}

/**
 * Mensaje de error inline (ticket 026, hallazgo real durante el
 * refactor: `ImportTextureControl`/`PasteImageControls`/
 * `ExportControls`/`ProjectControls` repetían el MISMO `<p role="alert"
 * style={...}>` palabra por palabra). `role="alert"` -- nunca un
 * `window.alert()` nativo (regla del proyecto, ver memoria
 * `texture-studio-mc-sin-dialogos-nativos`).
 */
export function InlineError({ message }: InlineErrorProps) {
  return <p className="ui-inline-error" role="alert">{message}</p>;
}
