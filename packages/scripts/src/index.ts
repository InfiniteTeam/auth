/* eslint-disable no-console */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import {
  ApiModel,
  ApiDocumentedItem,
  ApiParameterListMixin,
  ApiReturnTypeMixin,
  ApiStaticMixin,
  ApiReadonlyMixin,
  type ApiItem,
} from "@microsoft/api-extractor-model";
import { DocComment, DocNode, DocPlainText, DocCodeSpan, DocInlineTag } from "@microsoft/tsdoc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SplitOptions {
  source: string;
  outputDir: string;
}

interface MemberDoc {
  name: string;
  kind: string;
  signature: string;
  summary: string;
}

function renderNode(node: DocNode): string {
  if (node instanceof DocPlainText) {
    return node.text;
  }
  if (node instanceof DocCodeSpan) {
    return `\`${node.code}\``;
  }
  if (node instanceof DocInlineTag) {
    return node.tagName.replace(/^@/, "");
  }
  return node.getChildNodes().map(renderNode).join("");
}

function renderSummary(comment: DocComment | undefined): string {
  if (!comment) {
    return "";
  }
  return renderNode(comment.summarySection).trim();
}

function signatureOf(item: ApiItem): string {
  if (!ApiParameterListMixin.isBaseClassOf(item)) {
    return "";
  }
  const params = item.parameters
    .map((param) => `${param.name}${param.isOptional ? "?" : ""}: ${param.parameterTypeExcerpt.text}`)
    .join(", ");
  const typeParams = ApiReturnTypeMixin.isBaseClassOf(item) ? item.returnTypeExcerpt.text : "";
  return `(${params}${typeParams ? `): ${typeParams}` : ""}`;
}

function collectMembers(item: ApiItem): MemberDoc[] {
  const members: MemberDoc[] = [];

  for (const member of item.members) {
    if (!(member instanceof ApiDocumentedItem)) {
      continue;
    }
    const parts: string[] = [member.kind];
    if (ApiStaticMixin.isBaseClassOf(member) && member.isStatic) {
      parts.push("static");
    }
    if (ApiReadonlyMixin.isBaseClassOf(member) && member.isReadonly) {
      parts.push("readonly");
    }
    members.push({
      name: member.displayName,
      kind: parts.join(" "),
      signature: signatureOf(member),
      summary: renderSummary(member.tsdocComment),
    });
    members.push(...collectMembers(member));
  }

  return members;
}

function toFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9_.-]/g, "-").replace(/-+/g, "-");
}

/**
 * Loads an API Extractor doc model (`*.api.json`) and writes one Markdown
 * document per top-level API member (class, function, interface, type, ...).
 *
 * The generated documents follow the same source-of-truth idea as the
 * "api report": doc comments are extracted from the TSDoc model and split
 * into per-member files for easy browsing.
 */
export async function generateSplitDocumentation(options: SplitOptions): Promise<string[]> {
  const { source, outputDir } = options;

  const model = new ApiModel();
  const apiPackage = model.loadPackage(source);
  const entryPoint = apiPackage.members[0];
  const topLevelMembers = (entryPoint?.members.length ? entryPoint.members : apiPackage.members) ?? [];

  await mkdir(outputDir, { recursive: true });

  const written: string[] = [];

  for (const item of topLevelMembers) {
    const summary = item instanceof ApiDocumentedItem ? renderSummary(item.tsdocComment) : "";
    const members = collectMembers(item);

    const lines: string[] = [`# ${item.displayName}`, ""];

    const kindLine = [`**${item.kind}**`];
    const sig = signatureOf(item);
    if (sig) {
      kindLine.push(sig);
    }
    lines.push(kindLine.join(" "), "");
    if (summary) {
      lines.push(summary, "");
    }

    if (members.length > 0) {
      lines.push("## Members", "");
      for (const member of members) {
        lines.push(`### ${member.name}`, "");
        if (member.kind) {
          lines.push(`**${member.kind}**${member.signature ? ` ${member.signature}` : ""}`, "");
        }
        if (member.summary) {
          lines.push(member.summary, "");
        }
      }
    }

    const fileName = `${toFileName(item.displayName)}.md`;
    const targetPath = path.join(outputDir, fileName);
    await writeFile(targetPath, `${lines.join("\n").trimEnd()}\n`, "utf8");
    written.push(targetPath);
  }

  return written;
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("generate-split-documentation")
    .description("Split an API Extractor doc model (*.api.json) into per-member Markdown documents.")
    .option("-s, --source <path>", "Path to the doc model file", "docs/docs.api.json")
    .option("-o, --output-dir <path>", "Output directory for split documents", "docs")
    .option("-c, --cwd <path>", "Working directory (defaults to the current process cwd)")
    .action(async (opts: { source: string; outputDir: string; cwd?: string }) => {
      const cwd = opts.cwd ?? process.cwd();
      const source = path.resolve(cwd, opts.source);
      const outputDir = path.resolve(cwd, opts.outputDir);

      const written = await generateSplitDocumentation({ source, outputDir });
      for (const file of written) {
        console.log(`Generated ${path.relative(cwd, file)}`);
      }
      console.log(`\nWrote ${written.length} documents to ${path.relative(cwd, outputDir)}/`);
    });

  await program.parseAsync(process.argv);
}

void main();