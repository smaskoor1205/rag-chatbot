# Local-first Document Q&A

This app now follows the Mozilla.ai lightweight RAG blueprint style:

1. Extract structured document text with `PyMuPDF4LLM`.
2. Split extracted Markdown into heading-based sections.
3. Find and retrieve relevant sections with local lexical scoring.
4. Answer with a local GGUF model through `llama.cpp`.
5. Show retrieved sections as citations.

## Run Locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Add a Local Model

Download a GGUF instruct model and place it in:

```text
models/
```

Recommended starting point for laptops:

```text
Qwen2.5-3B-Instruct Q4_K_M GGUF
```

For stronger answers on machines with more RAM:

```text
Qwen2.5-7B-Instruct Q4_K_M GGUF
```

Then set the model path in the sidebar, for example:

```text
models/qwen2.5-7b-instruct-q4_k_m.gguf
```

## Why Local-first

- No OpenAI API key required.
- Documents stay on your machine.
- No vector database required.
- Good fit for structured PDFs, reports, manuals, rulebooks, and policies.

## Hardware Notes

- 3B quantized model: usually comfortable on 8 GB to 12 GB RAM.
- 7B quantized model: usually needs around 10 GB to 16 GB RAM.
- Increase CPU threads in the sidebar if generation is slow.
