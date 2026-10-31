# Offline dialogue model comparison

31 October 2026, PR #29. Both residency measurement and matched answer trials
are complete; Agent review pending. This continues the
[initial helper evaluation](NPC_DIALOGUE_RETRIEVAL_RESULTS.md).
Follow-up: [8B-only helper presentation and query experiment](NPC_DIALOGUE_8B_PRESENTATION.md).

## Residency and candidate provenance

Hardware: RTX 5080, NVIDIA-reported total 16,303 MiB, WDDM driver 617.14,
Intel Core Ultra 7 265KF (20 logical processors), approximately 32 GB RAM.
Runtime: existing Ollama 0.40.13, `llamacpp` runner, tested context 16,384.
Backend identifies itself as 0.8.0-dev, build 1, commit `39febd2ad`.
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

## Matched experiment

All 24 new trials used unchanged helper code at `8a27063`, indexed mode,
the same frozen synthetic/realistic snapshots and checkpoint grants, and the
same questions/personas for each model. Documentation commits made during and
after the run do not alter the tested code. Neither model received the independent
fixture/SQL answer oracle. Each model chose its own tool calls.

Order: six 27B trials, six 8B trials, six 8B trials, six 27B trials. Models were
unloaded between groups, with `/api/ps` checks; no global scheduling options
changed. Each group began with an unloaded-model question. A fresh reader was
built for every trial. Cold means model-unloaded, not a flushed OS file cache.
There were two model-cold and ten warm trials per model.

Both used temperature 0.15, context 16,384, output limit 1,600, `think:false`,
non-streamed replies, ten-minute keep-alive and the existing context/time guards.
Both advertise thinking/tool support. Registry sampling defaults agree on
top-k 20, top-p 0.95 and repeat penalty 1; explicit temperature overrides their
different defaults. Tokenisers/templates, output lengths and tool choices differ.
This is an unchanged-configuration comparison, not a tuned candidate result.

The question set includes basic identity, three realistic reports, two repetitions
each of formal/informal conversational questions, explicit combat/order evidence,
transfer history, a saved branch and a fresh survival/order/completeness question.

## Complete-response timing

Seconds include reader preparation, all model/tool turns, guards, trace writes and
host overhead. First usable text is the complete non-streamed answer; interrupted
attempts produce no usable reply. Two repeated conversational trials and two warm
realistic reports per model are small samples, not general latency guarantees.

| Matched question / condition | 27B seconds | 8B seconds | Factual outcome |
| --- | ---: | ---: | --- |
| Basic identity, model cold | 25.42 | 27.41 | Both passed |
| Realistic report, warm #1 | 39.41 | 4.18 | 27B passed; 8B missing required identity/refs |
| Realistic report, model cold | 52.25 | 6.39 | 27B passed; 8B missing identity/refs, unsupported operational wording |
| Realistic report, warm #2 | 38.53 | 8.61 | 27B passed; 8B missing required identity/refs |
| Conversational formal, warm #1 / #2 | 22.57 / 22.53 | 1.23 / 1.35 to refusal | 27B false absence/completeness; 8B made no tool call |
| Conversational informal, warm #1 / #2 | 23.51 / 25.18 | 1.27 / 1.23 to refusal | Same problems |
| Explicit combat/order, warm | 27.14 | 2.04 | 27B passed; 8B misidentified an attacking event as the order |
| Transfer chronology, warm | 34.92 | 2.99 | 27B passed; 8B missed docking/removal/later Marine role |
| Saved branch, warm | 29.29 | 1.21 | 27B passed; 8B did not retrieve required final event |
| Fresh survival/order question, warm | 25.03 | 1.74 | 27B passed with labelled inference; 8B incomplete/misleading order interpretation |

Realistic warm reports, median of two:

| Component | 27B | 8B |
| --- | ---: | ---: |
| Whole completed generation | 38.973 s | 6.392 s |
| Reader preparation | 1.707 s | 1.881 s |
| Tool execution sum | 42.91 ms | 40.11 ms |
| Model load | 16.19 ms | 10.62 ms |
| Prompt evaluation | 4.818 s | 2.559 s |
| Generation | 31.049 s | 1.152 s |
| Model / tool calls | 4 / 5 | 3 / 2 |
| Accumulated prompt / generated tokens | 15,313 / 426.5 | 6,210 / 158.5 |
| Accumulated request / returned tool bytes | 55,342 / 16,165 | 23,802 / 3,032 |

The 8B responses are shorter and skip required retrieval, so 6.392 seconds is
**not** a demonstrated time to an equally correct answer. Both retrieved the
correct realistic numeric totals in all three runs, but only 27B supplied the
required identity/grounding. Reproduced 27B whole-response latency is close to
the earlier 38.01-second result; there is no new helper-versus-baseline trial here.

Cold basic load/prompt/generation components were 16.20/1.86/6.84 seconds for
27B and 12.64/8.53/5.76 for 8B. The first 8B load had substantial startup costs;
do not hide it behind warm token speed. Cold realistic load was 15.70 seconds
for 27B and 2.09 for 8B. No new snapshot was created: this reuses the earlier
frozen copy, whose separately measured capture cost was 8.39 seconds.

## Memory and activity during requests

Sampling used Windows GPU adapter/process counters, process CPU-time deltas and
RAM counters, `nvidia-smi` queries and `/api/ps`, approximately every 1.5 seconds.
Short 8B requests yield fewer samples and their peaks can be missed. Initial
telemetry omitted the separately named `llama-server` process; the corrected
collector captured the subsequent representative requests for both models.
Original samples were retained. Unloaded/loaded-idle/request phases are labelled.
Non-streamed requests do not expose an exact live prompt/generation boundary;
their separate durations above come from the runtime, not guessed telemetry.

| Observed request metric | 27B | 8B |
| --- | ---: | ---: |
| Device used memory, median / maximum | 15,555 / 15,698 MiB | 8,765 / 8,811 MiB |
| Device reported free, minimum–maximum | 280–460 MiB | 7,167–7,221 MiB |
| Runner dedicated GPU allocation, median | 13.96 GiB | 7.34 GiB |
| Runner shared GPU allocation, median | 4.10 GiB | 0.50 GiB |
| Runner working set, median / maximum | 9.35 / 12.82 GiB | 1.07 / 1.76 GiB |
| Runner private committed bytes, median / maximum | 24.17 / 27.65 GiB | 8.58 / 9.29 GiB |
| Sampled GPU utilisation, median / maximum | 24% / 99% | 1% / 94% |
| Runner CPU, normalised over 20 logical processors, median | 49.1% | 4.8% |
| Request device samples / runner samples | 209 / 196 | 19 / 19 |

Unloaded device use was approximately 1.3 GiB. Loaded-idle samples were also
retained (13 for 27B, 16 for 8B). Private committed bytes are not physical RAM
resident in the process; GPU allocations must not be added to these figures as
if they were independent physical usage. Device totals include the desktop and
other unchanged applications. CPU percentages are process activity, not an
offload percentage. Sparse sampling and host work during request windows explain
why short, fully offloaded 8B requests can have a low sampled median GPU activity.

The candidate leaves roughly 7 GiB reported free on this otherwise idle desktop
workload. There is still about 0.5 GiB of runner shared allocation. Full offload
is verified; zero shared-memory use or absence of all WDDM migration is not.
Shared allocation does not distinguish pinned host mappings from actual paging.
The 27B residency split and high CPU activity support CPU/system-memory work
as a contributor; they do not isolate its exact latency cost. Model architecture,
token counts, prompt caching and tool behaviour also differ.

## Independently checked factual results

| Result | 27B | 8B |
| --- | ---: | ---: |
| Total attempts | 12 | 12 |
| Completed tool-grounded generations | 12 | 8 |
| Incomplete: no successful tool call | 0 | 4 |
| Strict factual/required-coverage passes | 8/12 | 1/12 |
| Tool dispatch errors | 0 | 0 |
| Realistic numeric totals correct | 3/3 | 3/3 |

The strict score requires material claims to be supported and the requested
facts supplied. An honest refusal to guess is useful but does not complete a
question when the relevant evidence is available and unqueried. These are
case-level manual checks against the frozen fixture and independent raw SQL,
not population accuracy estimates or a validated automatic grader.

27B failed the four ordinary conversational trials by claiming no recorded order
or describing a subset as the whole available account. On the explicit fresh
question it retrieved the ready Attack order and distinguished a possible
survival inference from an explicit survival record. This sensitivity to wording
remains an accuracy problem.

8B passed the basic identity question. Its three realistic reports had correct
totals but omitted the NPC name/source refs; one inferred defensive operations
from a fleet role. In transfer history it ignored a returned continuation cursor,
then falsely called Captain the latest role and denied an available docking.
Its combat answer cited an ATTACKING event as the order. The branch answer did
not retrieve the final docking. The fresh answer called an order-state change a
tactical shift without reading details. Four conversational attempts invented
incident details without using a tool; the host returned INCOMPLETE and withheld
those replies. The refusals are not fast successful dialogue.

Both styles were exercised, but no validated personality/naturalness score was
assigned. Replies remain report-like; 8B often used lists or third-person wording.
Factual correctness took priority over stylistic preference. All original
attempts, including failed replies, remain local; none was replaced by a repair.

## Validation and recommendation

Reran the 28 relevant helper/profile/history tests on Node 24.21.0: all passed,
zero failures/skips. Syntax, diff and privacy checks passed. Original database,
catalogue, anchor and registration hashes remain unchanged; frozen input hashes
match; all 37 installed companion files match the existing deployment manifest.
Both benchmark models are unloaded. No runtime/helper code changed during this
comparison, and no X4 XML/schema validation was applicable.

Keep the 27B model as the development researcher. The 8B candidate demonstrates
the desired residency/headroom and high warm inference speed, but does not meet
the current dialogue accuracy/retrieval-following bar. Do not select it for
gameplay from this comparison. Next, investigate reliable evidence completion
and claim validation with fixed adversarial questions, keeping tuned trials
separate from this unchanged controlled set. Inference dominates 27B latency;
SQLite tool time does not explain a 39-second wait.

No X4 launch, TTS integration, deployment, production mutation or merge occurred.
Voice/game contention remains untested. Combined evidence is returned to Agent;
PR #29 remains draft and unmerged.
