"""Ejecuta el código de una práctica y, si se pide, su comprobación (en el mismo espacio de nombres)."""

import builtins
import textwrap
import traceback
from pyodide.code import eval_code_async

import curso

PISTAS = {
    "SyntaxError": "Error de sintaxis: revisa paréntesis, comillas y los dos puntos (:) al final de def, if, for o while.",
    "IndentationError": "Error de sangría: lo que va dentro de def, if, for o while lleva 4 espacios más que la línea de arriba.",
    "TabError": "Mezclas tabuladores y espacios en la sangría: usa siempre 4 espacios.",
    "NameError": "Usas un nombre que no existe. ¿Está bien escrito? ¿Lo has definido (o importado) antes de usarlo?",
    "TypeError": "Tipo incorrecto: revisa los argumentos que pasas a la función, o si estás mezclando texto y números.",
    "KeyError": "Esa clave no está en el diccionario. Revisa cómo se llama exactamente.",
    "AttributeError": "Ese objeto no tiene ese atributo. Si es un diccionario usa ['clave']; si es un objeto, .atributo.",
    "IndexError": "Te sales de la lista: pides una posición que no existe.",
    "ZeroDivisionError": "Divides entre cero.",
    "ModuleNotFoundError": "Ese paquete no está disponible sin conexión. Aquí tienes la biblioteca estándar de Python y pydantic.",
    "ImportError": "No se puede importar eso. Sin conexión tienes la biblioteca estándar de Python, pydantic y el módulo curso.",
    "JSONDecodeError": "El texto no es un JSON válido.",
    "ValidationError": "Pydantic ha rechazado los datos: no encajan con el modelo (falta un campo o el tipo no es el correcto).",
    "RecursionError": "Una función se llama a sí misma sin fin.",
    "UnboundLocalError": "Usas una variable dentro de la función antes de darle valor.",
}

ARCHIVOS = {"tu_codigo.py": "tu código", "comprobacion.py": "la comprobación"}


def _sin_input(*args, **kwargs):
    raise RuntimeError("input() no está disponible en las prácticas: escribe el valor directamente en una variable.")


builtins.input = _sin_input


def _formatear(exc):
    nombre = type(exc).__name__
    marcos = [m for m in traceback.extract_tb(exc.__traceback__) if m.filename in ARCHIVOS]
    linea, archivo = None, None
    if marcos:
        # la última línea que es de tu código (si la hay) es la más útil
        propios = [m for m in marcos if m.filename == "tu_codigo.py"]
        m = (propios or marcos)[-1]
        linea, archivo = m.lineno, m.filename
    if isinstance(exc, SyntaxError) and exc.filename in ARCHIVOS:
        linea, archivo = exc.lineno, exc.filename
    texto = "".join(traceback.format_exception_only(type(exc), exc))
    # la línea 'File "tu_codigo.py", line N' sobra: ya se indica la línea aparte
    texto = textwrap.dedent("\n".join(l for l in texto.splitlines() if not l.strip().startswith('File "'))).strip()
    return {
        "type": nombre,
        "msg": texto,
        "line": linea,
        "where": ARCHIVOS.get(archivo, ""),
        "hint": PISTAS.get(nombre, ""),
    }


async def ejecutar(code, tests=None):
    curso._reset_checks()
    ns = {"__name__": "__main__"}
    valor = None
    try:
        res = await eval_code_async(code, ns, filename="tu_codigo.py")
        if res is not None:
            valor = repr(res)[:4000]
    except BaseException as e:  # noqa: BLE001 - mostramos cualquier error al alumno
        return {"ok": False, "phase": "code", "error": _formatear(e)}
    if not isinstance(tests, str):
        return {"ok": True, "phase": "code", "value": valor}
    try:
        await eval_code_async(tests, ns, filename="comprobacion.py", return_mode="none")
    except AssertionError as e:
        return {"ok": False, "phase": "tests", "failed": str(e), "passed": list(curso._checks), "value": valor}
    except NameError as e:
        falta = getattr(e, "name", None) or str(e)
        return {"ok": False, "phase": "tests", "passed": list(curso._checks), "value": valor,
                "failed": f"No encuentro «{falta}» en tu código. ¿Has cambiado el nombre o lo has borrado?"}
    except BaseException as e:  # noqa: BLE001
        return {"ok": False, "phase": "tests", "error": _formatear(e), "passed": list(curso._checks), "value": valor}
    return {"ok": True, "phase": "tests", "passed": list(curso._checks), "value": valor}
