import "sanitize.css";
import "sanitize.css/forms.css";
import "./style.css";

import type { Instance } from "@wasmer/sdk";
import { init, runWasix } from "@wasmer/sdk";
import wasmerSDKUrl from "@wasmer/sdk/dist/wasmer_js_bg.wasm?url";
import intrWasmUrl from "./intr.wasm?url";

const form = document.querySelector<HTMLFormElement>("#form")!;
const lineForm = document.querySelector<HTMLFormElement>("#line-form")!;
const sendEofBtn = document.querySelector<HTMLButtonElement>("#send-eof")!;
let communicate = document.querySelector<HTMLElement>("#communicate")!;
const communicate_backup = communicate.cloneNode();
const output = document.querySelector<HTMLTextAreaElement>("#report")!;

async function main() {
  await init(wasmerSDKUrl);

  const wasm = await WebAssembly.compileStreaming(fetch(intrWasmUrl));

  let stdin: WritableStreamDefaultWriter | null = null;
  let instance: Instance | null = null;

  while (communicate_backup.hasChildNodes()) {
    communicate_backup.removeChild(communicate_backup.firstChild!);
  }

  async function reset() {
    if (stdin !== null) {
      await stdin.close();
      stdin = null;
    }
    if (instance !== null) {
      await instance.wait();
      instance = null;
    }
    output.value = "";
    {
      const newNode = communicate_backup.cloneNode();
      communicate.replaceWith(newNode);
      communicate = newNode as HTMLElement;
    }
  }

  form.onsubmit = async (e: SubmitEvent) => {
    e.preventDefault();

    await reset();

    const data = new FormData(form);
    const n = data.get("n")! as unknown as number;
    const m = data.get("m")! as unknown as number;

    instance = await runWasix(wasm, {
      program: "intr",
      args: ["/work/inf", "--report-format=json"],
      env: { NO_COLOR: "1" },
      mount: {
        "/work": {
          inf: `${n} ${m}\n`,
        },
      },
    });

    stdin = instance.stdin!.getWriter()!;

    const stdoutDecoder = new TextDecoderStream("utf-8");
    instance.stdout.pipeTo(stdoutDecoder.writable);

    stdoutDecoder.readable.pipeTo(
      new WritableStream({
        write: (chunk) => {
          const pre = document.createElement("pre");
          pre.textContent = chunk;
          communicate.appendChild(pre);
        },
      }),
    );

    const stderrDecoder = new TextDecoderStream("utf-8");
    instance.stderr.pipeTo(stderrDecoder.writable);
    stderrDecoder.readable.pipeTo(
      new WritableStream({
        write: (chunk) => {
          output.value += chunk;
        },
      }),
    );
  };

  lineForm.onsubmit = async (e: SubmitEvent) => {
    e.preventDefault();

    const data = new FormData(lineForm);
    const line = data.get("line")!.toString();

    if (instance === null) {
      // eslint-disable-next-line no-alert
      alert("Run the program first");
      return;
    }

    const encoder = new TextEncoder();
    await stdin!.write(encoder.encode(`${line}\n`));

    const pre = document.createElement("pre");
    pre.classList.add("user-input");
    pre.textContent = `${line}\n`;
    communicate.appendChild(pre);
  };

  sendEofBtn.onclick = () => {
    if (instance === null) {
      // eslint-disable-next-line no-alert
      alert("Run the program first");
      return;
    }

    stdin!.close();
  };
}

main();
