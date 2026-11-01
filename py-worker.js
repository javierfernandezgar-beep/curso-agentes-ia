// Ejecuta Python (Pyodide) fuera del hilo principal, para que la app no se congele y se pueda parar un bucle infinito.
import { loadPyodide } from './vendor/pyodide/pyodide.mjs';

let py = null;
let runner = null;
const post = (m) => self.postMessage(m);

async function init(files) {
  py = await loadPyodide({ indexURL: new URL('./vendor/pyodide/', import.meta.url).href });
  py.setStdin({ error: true });
  for (const [name, src] of Object.entries(files)) py.FS.writeFile('/home/pyodide/' + name, src);
  py.runPython("import sys\nif '/home/pyodide' not in sys.path: sys.path.insert(0, '/home/pyodide')");
  runner = py.pyimport('runner');
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try { await init(m.files); post({ type: 'ready', version: py.version }); }
    catch (err) { post({ type: 'fatal', msg: String(err && err.message || err) }); }
    return;
  }
  if (m.type === 'run') {
    py.setStdout({ batched: (s) => post({ type: 'out', s }) });
    py.setStderr({ batched: (s) => post({ type: 'err', s }) });
    try {
      await py.loadPackagesFromImports(m.code + '\n' + (m.tests || ''), {
        messageCallback: (msg) => { if (/^Loading/.test(msg)) post({ type: 'status', msg: 'Cargando ' + msg.replace(/^Loading\s+/, '') + '…' }); },
        errorCallback: () => {},
      });
    } catch (err) { /* si falla, el import dará el error dentro de Python */ }
    post({ type: 'started' });
    let res;
    try {
      // undefined llega a Python como None (null llegaría como jsnull)
      const r = await runner.ejecutar(m.code, typeof m.tests === 'string' ? m.tests : undefined);
      res = r.toJs({ dict_converter: Object.fromEntries });
      r.destroy();
    } catch (err) {
      res = { ok: false, phase: 'code', error: { type: 'Error', msg: String(err && err.message || err), line: null, where: '', hint: '' } };
    }
    post({ type: 'done', res });
  }
};
