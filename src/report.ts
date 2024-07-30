export interface IncompleteTrace {
  var_name: string;
  line_num: number;
  col_num: number;
  byte_num: number;
}

export interface CompleteTrace {
  n: string;
  b: number;
  l: number;
}

export interface TraceStack {
  stream_name: string;
  stack: IncompleteTrace[];
}

export interface TraceTreeNode {
  trace: CompleteTrace;
  tag?: Record<string, unknown>;
  children?: TraceTreeNode[];
}

export interface Report {
  status: "internal_error" | "valid" | "invalid";
  message: string;
  traits?: Record<string, boolean>;
  reader_trace_stack?: TraceStack;
  reader_trace_tree?: TraceTreeNode[];
}
