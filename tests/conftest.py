import sys
import types


def _install_stub(name: str) -> types.ModuleType:
    module = types.ModuleType(name)
    sys.modules.setdefault(name, module)
    return sys.modules[name]


pymupdf4llm = _install_stub("pymupdf4llm")
pymupdf4llm.to_markdown = lambda *_args, **_kwargs: ""

docx = _install_stub("docx")
docx.Document = lambda *_args, **_kwargs: types.SimpleNamespace(paragraphs=[])

bs4 = _install_stub("bs4")
bs4.BeautifulSoup = lambda *_args, **_kwargs: types.SimpleNamespace(
    __call__=lambda *_call_args, **_call_kwargs: [],
    find_all=lambda *_find_args, **_find_kwargs: [],
)

llama_cpp = _install_stub("llama_cpp")
llama_cpp.Llama = object

streamlit = _install_stub("streamlit")
streamlit.secrets = {}
streamlit.cache_resource = lambda *args, **_kwargs: (lambda func: func) if args == () else args[0]
