import "sanitize.css";
import "sanitize.css/forms.css";
import "./style.css";

import type { Instance } from "@wasmer/sdk";
import { init, runWasix } from "@wasmer/sdk";
import wasmerSDKUrl from "@wasmer/sdk/dist/wasmer_js_bg.wasm?url";
import intrWasmUrl from "./intr.wasm?url";

await init(wasmerSDKUrl);

const wasm = await WebAssembly.compileStreaming(fetch(intrWasmUrl));

const form = document.querySelector<HTMLFormElement>("#form")!;
const lineForm = document.querySelector<HTMLFormElement>("#line-form")!;
const sendEofBtn = document.querySelector<HTMLButtonElement>("#send-eof")!;
let communicate = document.querySelector<HTMLElement>("#communicate")!;
const communicate_backup = communicate.cloneNode();
const output = document.querySelector<HTMLTextAreaElement>("#report")!;
let stdin: WritableStreamDefaultWriter | null = null;
let instance: Instance | null = null;

while (communicate_backup.hasChildNodes()) {
  communicate_backup.removeChild(communicate_backup.firstChild!);
}

function reset() {
  output.value = "";
  {
    const newNode = communicate_backup.cloneNode();
    communicate.replaceWith(newNode);
    communicate = newNode as HTMLElement;
  }
  if (stdin !== null) {
    stdin.close();
    stdin = null;
  }
  if (instance !== null) {
    instance!.free();
    instance = null;
  }
}

form.onsubmit = async (e: SubmitEvent) => {
  e.preventDefault();

  reset();

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
