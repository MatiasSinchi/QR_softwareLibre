import { setZXingModuleOverrides } from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

// En navegadores sin detector nativo (Safari/iPhone, Firefox) la lectura usa un módulo WASM.
// Por defecto se descargaría de una CDN externa en cada uso; aquí se sirve desde nuestro propio
// sitio: sin código de terceros en tiempo de ejecución y sin depender de la red de una CDN.
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
});
