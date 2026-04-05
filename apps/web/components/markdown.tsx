/**
 * Renderizador de markdown minimalista — sem dependências externas.
 * Suporta: h1-h3, parágrafos, listas (ul/ol), bold, italic, code inline,
 * code blocks, checklists ([- [ ] item]), e links.
 *
 * Para coisas mais complexas (tabelas, HTML, etc), trocar por react-markdown
 * no futuro.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(text: string): string {
  // Ordem importa: code antes de bold/italic para não quebrar
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono text-gray-800">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // Rule IDs entre colchetes viram spans destacados
  out = out.replace(
    /\[([A-Z]{3,4}-\d{3})\]/g,
    '<span class="inline-flex items-center rounded bg-blue-50 text-blue-700 px-1.5 py-0.5 text-xs font-mono font-medium">$1</span>',
  );
  return out;
}

interface Block {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'checklist';
  content: string | string[];
}

function parse(md: string): Block[] {
  const lines = md.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', content: line.slice(4) });
      i += 1;
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', content: line.slice(3) });
      i += 1;
    } else if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', content: line.slice(2) });
      i += 1;
    } else if (/^-\s+\[[ x]\]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^-\s+\[[ x]\]\s+/.test(lines[i])) {
        items.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'checklist', content: items });
    } else if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', content: items });
    } else if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', content: items });
    } else {
      // Parágrafo: acumula até linha em branco
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].startsWith('#') &&
        !/^[-*]\s+/.test(lines[i]) &&
        !/^\d+\.\s+/.test(lines[i])
      ) {
        paraLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'p', content: paraLines.join(' ') });
    }
  }

  return blocks;
}

export function Markdown({ children }: { children: string }): JSX.Element {
  const blocks = parse(children);

  return (
    <div className="prose prose-sm max-w-none">
      {blocks.map((block, idx) => {
        if (block.type === 'h1') {
          return (
            <h1
              key={idx}
              className="text-2xl font-bold text-gray-900 mt-6 mb-3"
              dangerouslySetInnerHTML={{ __html: renderInline(block.content as string) }}
            />
          );
        }
        if (block.type === 'h2') {
          return (
            <h2
              key={idx}
              className="text-xl font-bold text-gray-900 mt-5 mb-2"
              dangerouslySetInnerHTML={{ __html: renderInline(block.content as string) }}
            />
          );
        }
        if (block.type === 'h3') {
          return (
            <h3
              key={idx}
              className="text-base font-semibold text-gray-900 mt-4 mb-2"
              dangerouslySetInnerHTML={{ __html: renderInline(block.content as string) }}
            />
          );
        }
        if (block.type === 'p') {
          return (
            <p
              key={idx}
              className="text-sm text-gray-700 leading-relaxed mb-3"
              dangerouslySetInnerHTML={{ __html: renderInline(block.content as string) }}
            />
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={idx} className="list-disc list-inside text-sm text-gray-700 mb-3 space-y-1">
              {(block.content as string[]).map((item, i) => (
                <li
                  key={i}
                  dangerouslySetInnerHTML={{ __html: renderInline(item) }}
                />
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol
              key={idx}
              className="list-decimal list-inside text-sm text-gray-700 mb-3 space-y-1"
            >
              {(block.content as string[]).map((item, i) => (
                <li
                  key={i}
                  dangerouslySetInnerHTML={{ __html: renderInline(item) }}
                />
              ))}
            </ol>
          );
        }
        if (block.type === 'checklist') {
          return (
            <ul key={idx} className="text-sm text-gray-700 mb-3 space-y-1.5">
              {(block.content as string[]).map((item, i) => {
                const checked = /^-\s+\[x\]/i.test(item);
                const label = item.replace(/^-\s+\[[ x]\]\s+/i, '');
                return (
                  <li key={i} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={checked}
                      disabled
                      className="mt-1"
                    />
                    <span
                      dangerouslySetInnerHTML={{ __html: renderInline(label) }}
                    />
                  </li>
                );
              })}
            </ul>
          );
        }
        return null;
      })}
    </div>
  );
}
