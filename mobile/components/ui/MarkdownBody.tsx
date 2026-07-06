/**
 * MarkdownBody — a small, dependency-free Markdown renderer covering what agent
 * and issue chat actually use: paragraphs, fenced code blocks, headings, bullet/
 * numbered lists, and inline `code` / **bold** / *italic*. Fully Aurora-themed.
 * (We deliberately avoid react-native-markdown-display — its react-native-fit-image
 * transitive dep is stale on RN 0.85 / New Architecture.)
 */
import { Fragment, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontFamily, radii, spacing } from "@/theme";

export function MarkdownBody({ children, color }: { children?: string | null; color?: string }) {
  const blocks = parseBlocks(children ?? "");
  return (
    <View>
      {blocks.map((b, i) => (
        <Block key={i} block={b} color={color} />
      ))}
    </View>
  );
}

type BlockNode =
  | { kind: "code"; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "para"; text: string };

function parseBlocks(src: string): BlockNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let i = 0;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "para", text: para.join("\n").trim() });
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    // fenced code
    if (/^\s*```/.test(line)) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    // heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      blocks.push({ kind: "heading", level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    // list (consume consecutive list lines)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flushPara();
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    // blank line → paragraph break
    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();
  return blocks;
}

function Block({ block, color }: { block: BlockNode; color?: string }) {
  const fg = color ?? colors.foreground;
  switch (block.kind) {
    case "code":
      return (
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>{block.text}</Text>
        </View>
      );
    case "heading":
      return (
        <Text style={[styles.heading, block.level === 1 && styles.h1, { color: fg }]}>
          {inline(block.text, fg)}
        </Text>
      );
    case "list":
      return (
        <View style={styles.list}>
          {block.items.map((it, idx) => (
            <View key={idx} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.teal }]}>
                {block.ordered ? `${idx + 1}.` : "•"}
              </Text>
              <Text style={[styles.paraText, { color: fg }]}>{inline(it, fg)}</Text>
            </View>
          ))}
        </View>
      );
    default:
      return <Text style={[styles.paraText, { color: fg }]}>{inline(block.text, fg)}</Text>;
  }
}

/** Inline tokens: `code`, **bold**, *italic*. */
function inline(text: string, fg: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(
        <Text key={k++} style={styles.inlineCode}>
          {tok.slice(1, -1)}
        </Text>,
      );
    } else if (tok.startsWith("**")) {
      out.push(
        <Text key={k++} style={{ fontFamily: fontFamily.sansSemibold, color: fg }}>
          {tok.slice(2, -2)}
        </Text>,
      );
    } else {
      out.push(
        <Text key={k++} style={styles.italic}>
          {tok.slice(1, -1)}
        </Text>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return out;
}

const styles = StyleSheet.create({
  paraText: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 21, marginBottom: 6 },
  heading: { fontFamily: fontFamily.sansSemibold, fontSize: 16, lineHeight: 22, marginBottom: 6 },
  h1: { fontFamily: fontFamily.displayBold, fontSize: 19 },
  list: { marginBottom: 6, gap: 3 },
  listItem: { flexDirection: "row", gap: 8 },
  bullet: { fontFamily: fontFamily.monoMedium, fontSize: 13, lineHeight: 21, minWidth: 16 },
  codeBlock: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.white08,
    borderRadius: radii.sm,
    padding: spacing[3],
    marginVertical: 4,
  },
  codeText: { fontFamily: fontFamily.mono, fontSize: 12.5, lineHeight: 18, color: colors.foregroundSoft },
  inlineCode: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: colors.teal,
  },
  italic: { fontStyle: "italic" },
});
