import "sanitize.css";
import "sanitize.css/forms.css";
import "./style.css";

import { instance } from "@viz-js/viz";
import wasmerSDKUrl from "@wasmer/sdk/dist/wasmer_js_bg.wasm?url";
import { AnsiUp } from "ansi_up";
import type { Report } from "./report";
import valWasmUrl from "./val.wasm?url";

const form = document.querySelector<HTMLFormElement>("#form")!;
let output = document.querySelector<HTMLElement>("#report")!;
const output_backup = output.cloneNode();

async function main() {
  const { init, runWasix } = await import("@wasmer/sdk");
  await init(wasmerSDKUrl);

  const viz = await instance();

  const wasm = await WebAssembly.compileStreaming(fetch(valWasmUrl));

  form.onsubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const data = new FormData(form);
    let input = data.get("input")!.toString();
    const reportFormat = data.get("report_format")!.toString() as
      | "colored-text"
      | "json"
      | "plain-text";

    if (data.get("do_format") === "on") {
      // Remove trailing spaces and end-of-text newlines of `input` string
      const lines = input.trimEnd().split("\n");
      const trimmedLines = lines.map((line) => line.trimEnd());
      input = `${trimmedLines.join("\n")}\n`;
    }

    let args = [];
    let env = {};

    switch (reportFormat) {
      case "colored-text":
        args = ["--report-format=text"];
        env = { CLICOLOR_FORCE: "1" };
        break;
      case "plain-text":
        args = ["--report-format=text"];
        env = { NO_COLOR: "1" };
        break;
      case "json":
        args = ["--report-format=json"];
        env = { NO_COLOR: "1" };
        break;
    }

    const instance = await runWasix(wasm, {
      program: "val",
      args,
      env,
      stdin: input,
    });
    const { stderr } = await instance.wait();

    {
      const newNode = output_backup.cloneNode();
      output.replaceWith(newNode);
      output = newNode as HTMLElement;
    }

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
        textArea.rows = 20;
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

        if (json.traits) {
          div = document.createElement("div");
          div.textContent = "Traits:";
          output.appendChild(div);

          const ul = document.createElement("ul");
          Object.entries(json.traits!).forEach(([name, sat]) => {
            const li = document.createElement("li");
            li.textContent = `${name}: ${sat}`;
            ul.appendChild(li);
          });

          output.appendChild(ul);
        }

        if (json.reader_trace_tree) {
          div = document.createElement("div");
          div.textContent = "Graph:";
          output.appendChild(div);

          const svg = viz.renderSVGElement({
            directed: false,
            edges: json
              .reader_trace_tree![0].children!.filter((x) => x.trace.n === "edges")[0]
              .children!.map((e) => {
                return {
                  head: e.children![0].tag!["#v"] as string,
                  tail: e.children![1].tag!["#v"] as string,
                };
              }),
          });
          output.appendChild(svg);
        }

        break;
      }
    }
  };
}

main();
