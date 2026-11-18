import React from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';

type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language: string }
  | { type: 'table'; rows: string[][] };

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseTextParts(content: string): MessagePart[] {
  const lines = content.split(/\r?\n/);
  const parts: MessagePart[] = [];
  let textLines: string[] = [];
  const flushText = () => {
    const text = textLines.join('\n').trim();
    if (text) parts.push({ type: 'text', content: text });
    textLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (
      lines[index].trim().startsWith('|') &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      flushText();
      const rows = [parseTableRow(lines[index])];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      parts.push({ type: 'table', rows });
      index -= 1;
    } else {
      textLines.push(lines[index]);
    }
  }
  flushText();
  return parts;
}

function parseMessageParts(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  const codeBlock = /```([a-zA-Z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlock.exec(content)) !== null) {
    parts.push(...parseTextParts(content.slice(lastIndex, match.index)));
    parts.push({ type: 'code', language: match[1], content: match[2].replace(/\n$/, '') });
    lastIndex = codeBlock.lastIndex;
  }

  parts.push(...parseTextParts(content.slice(lastIndex)));
  return parts.length > 0 ? parts : [{ type: 'text', content }];
}

interface Props {
  content: string;
}

export default function ChatMessageContent({ content }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
      {parseMessageParts(content).map((part, index) => {
        if (part.type === 'code') {
          return (
            <Paper
              key={`code-${index}`}
              variant="outlined"
              sx={{ position: 'relative', overflow: 'auto', bgcolor: '#202338', color: '#edf0ff', borderColor: '#34384f', borderRadius: 2 }}
            >
              {part.language && (
                <Typography variant="caption" sx={{ display: 'block', px: 1.5, pt: 1, color: '#b7bdd3' }}>
                  {part.language}
                </Typography>
              )}
              <Box
                component="pre"
                sx={{ m: 0, p: 1.5, pt: part.language ? 0.75 : 1.5, fontSize: '0.8rem', lineHeight: 1.65, fontFamily: '"SFMono-Regular", Consolas, monospace' }}
              >
                <code>{part.content}</code>
              </Box>
            </Paper>
          );
        }

        if (part.type === 'table') {
          const [header, ...rows] = part.rows;
          return (
            <TableContainer key={`table-${index}`} component={Paper} variant="outlined" sx={{ maxWidth: '100%', boxShadow: 'none', borderRadius: 2 }}>
              <Table size="small" sx={{ minWidth: 320 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f6f7fb' }}>
                    {header.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{cell}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex} hover>
                      {header.map((_, cellIndex) => (
                        <TableCell key={cellIndex}>{row[cellIndex] ?? ''}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          );
        }

        return (
          <Typography key={`text-${index}`} variant="body1" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.75 }}>
            {part.content}
          </Typography>
        );
      })}
    </Box>
  );
}
