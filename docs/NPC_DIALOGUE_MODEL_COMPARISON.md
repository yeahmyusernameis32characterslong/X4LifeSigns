# Offline dialogue model comparison

31 October 2026, PR #29. Residency measurements verified; matched answer trials
are in progress. This continues the [initial helper evaluation](NPC_DIALOGUE_RETRIEVAL_RESULTS.md).

## Residency and candidate provenance

Hardware: RTX 5080, NVIDIA-reported total 16,303 MiB, WDDM driver 617.14,
Intel Core Ultra 7 265KF (20 logical processors), approximately 32 GB RAM.
Runtime: existing Ollama 0.40.13, `llamacpp` runner, tested context 16,384.
X4 remained closed. No global runtime settings or researcher default changed.

| Observation | Existing development model | Smaller candidate |
| --- | --- | --- |
| Exact tag | `qwen3.8:27b-q4_K_M` | `qwen3:8b` |
| Reported family / parameters | qwen35 / 27.3B | qwen3 / 8.19B |
| Quantisation | Q4_K_M | Q4_K_M |
| Installed model bytes reported by Ollama | 17,741,872,132 | 5,225,388,164 |
| `ollama ps` placement at tested context | 24%/76% CPU/GPU | 100% GPU |
| Backend layer offload | 52/66 | 37/37 |
| CUDA model buffer | 11,900.79 MiB | 4,643.78 MiB |
| CUDA host model buffer | 3,869.56 MiB | 333.84 MiB |
| KV buffers reported | CPU 192 MiB + GPU 832 MiB | GPU 2,304 MiB |

The 27B model digest remains
`25b843619e944cd0ae6069f94ff4e5e26a16e109ccbc0a66a0f05979ed70098e`.
The candidate digest is
`500a1f067a9f782620b40bee6f7b0c89e17ae61f686b92c24933e4ca4b2b8b41`.
These are different model families/templates, not a controlled experiment that
isolates parameter count alone. The existing 27B tag has not been renamed or
replaced based on its metadata.

Selected one candidate from the [official Ollama registry](https://ollama.com/library/qwen3:8b),
with [Qwen's publisher card](https://huggingface.co/Qwen/Qwen3-8B) documenting
instruction/dialogue/tool capabilities and a native context above the tested
16,384. Registry and downloaded metadata identify Apache-2.0. There were
330,695,938,048 bytes free before the approved `ollama pull qwen3:8b`.
The reported 5.23 GB is model artefact size, not a measured network-transfer
total. Weights remain outside Git; the 27B model and research configuration remain.
Installing this candidate does not select it for eventual gameplay.

[Ollama documents PROCESSOR](https://docs.ollama.com/faq#how-can-i-tell-if-my-model-was-loaded-onto-the-gpu)
as memory placement. Its percentages are not the proportion of request time
spent computing on CPU/GPU. Backend offload logs independently support the
observed placement. Full layer offload still uses host RAM and CPU.

Windows adapter/process dedicated and shared usage, process working set/private
bytes, CPU-time deltas, GPU engine activity, `nvidia-smi` and `/api/ps` are sampled
during actual helper requests. Shared allocations are present even for the
smaller model. They do not by themselves identify which tensor was migrated or
prove paging caused a particular delay. [Microsoft describes shared GPU memory](https://devblogs.microsoft.com/directx/gpus-in-the-task-manager/)
as system RAM accessible to GPU/CPU; per-process memory figures can overlap.
We therefore keep adapter totals and per-runner figures separate.
[NVIDIA documents WDDM limitations](https://docs.nvidia.com/deploy/nvidia-smi/index.html)
on per-process memory accounting; unavailable values are not treated as zero.

Full GPU layer offload is established for this candidate and workload. A claim
of zero system RAM use, zero shared allocations or guaranteed X4/voice coexistence
is not established. Dialogue accuracy and complete-response timing are separate
evaluation gates.
