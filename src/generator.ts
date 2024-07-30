import "sanitize.css";
import "sanitize.css/forms.css";
import "./style.css";

import { init, runWasix } from "@wasmer/sdk";
import wasmerSDKUrl from "@wasmer/sdk/dist/wasmer_js_bg.wasm?url";
import { AnsiUp } from "ansi_up";
import genWasmUrl from "./gen.wasm?url";
import type { Report } from "./report";

await init(wasmerSDKUrl);

const wasm = await WebAssembly.compileStreaming(fetch(genWasmUrl));

const form = document.querySelector<HTMLFormElement>("#form")!;
let output = document.querySelector<HTMLElement>("#report")!;
const output_backup = output.cloneNode();

form.onsubmit = async (e: SubmitEvent) => {
  e.preventDefault();
  const data = new FormData(form);
  const nMin = data.get("n_min")! as unknown as number;
  const nMax = data.get("n_max")! as unknown as number;
  const same = !!data.get("same");
  const reportFormat = data.get("report_format")!.toString() as
    | "colored-text"
    | "json"
    | "plain-text";

  const args = ["--n-min", `${nMin}`, "--n-max", `${nMax}`];
  let env = {};

  if (same) {
    args.push("--same");
  }

  switch (reportFormat) {
    case "colored-text":
      args.push("--report-format=text");
      env = { CLICOLOR_FORCE: "1" };
      break;
    case "plain-text":
      args.push("--report-format=text");
      env = { NO_COLOR: "1" };
      break;
    case "json":
      args.push("--report-format=json");
      env = { NO_COLOR: "1" };
      break;
  }

  const instance = await runWasix(wasm, {
    program: "gen",
    args,
    env,
  });
  const { stdout, stderr } = await instance.wait();

  {
    const newNode = output_backup.cloneNode();
    output.replaceWith(newNode);
    output = newNode as HTMLElement;
  }

  let div = document.createElement("div");
  div.textContent = "Stdout:";
  output.appendChild(div);

  const textArea = document.createElement("textarea");
  textArea.disabled = true;
  textArea.value = stdout;
  textArea.rows = 10;
  output.appendChild(textArea);

  div = document.createElement("div");
  div.textContent = "Stderr:";
  output.appendChild(div);

  switch (reportFormat) {
    case "colored-text": {
      const box = document.createElement("pre");
      box.classList.add("ansi");
      const ansi_up = new AnsiUp();
      const html = ansi_up.ansi_to_html(stderr);
      box.innerHTML = html;
      output.appendChild(box);
      break;
    }
    case "plain-text": {
      const textArea = document.createElement("textarea");
      textArea.disabled = true;
      textArea.value = stderr;
      textArea.rows = 10;
      output.appendChild(textArea);
      break;
    }
    case "json": {
      const json = JSON.parse(stderr) as Report;

      const textArea = document.createElement("textarea");
      textArea.disabled = true;
      textArea.value = stderr;
      textArea.rows = 8;
      output.appendChild(textArea);

      let div = document.createElement("div");
      div.textContent = `Status: ${json.status}`;
      output.appendChild(div);

      div = document.createElement("div");
      div.textContent = `Message: ${json.message}`;
      output.appendChild(div);
      break;
    }
  }
};
